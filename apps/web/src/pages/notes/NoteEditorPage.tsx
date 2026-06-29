import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteEditor } from '@/components/editor/NoteEditor';
import { useDraftStore } from '@/stores/draftStore';
import type { Note } from '@/types/notes';
import type { Draft } from '@/stores/draftStore';

// Shown immediately at /notes/new while POST fires in background.
// noteId = '' makes useAutosave a no-op so no PATCH fires before redirect.
const NEW_NOTE_STUB: Note = {
  id: '',
  title: 'Untitled',
  body: { type: 'doc', content: [] },
  tagIds: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  version: 1,
};

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const clearDraft = useDraftStore((s) => s.clearDraft);

  const isNew = !id;
  const createCalledRef = useRef(false);
  const draftToastShownRef = useRef(false);

  const [draftToRestore, setDraftToRestore] = useState<Draft | null>(null);

  // ── /notes/new: create blank note immediately on mount ───────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Note>('/notes', {
        title: 'Untitled',
        body: { type: 'doc', content: [] },
        tagIds: [],
      });
      return data;
    },
    onSuccess: (note) => {
      queryClient.setQueryData(['note', note.id], note);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      navigate(`/notes/${note.id}`, { replace: true });
    },
    onError: () => {
      toast.error('Failed to create note.');
      navigate('/notes');
    },
  });

  useEffect(() => {
    if (!isNew || createCalledRef.current) return;
    createCalledRef.current = true;
    createMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── /notes/:id: load existing note ───────────────────────────────────────
  const {
    data: note,
    isLoading,
    isError,
  } = useQuery<Note>({
    queryKey: ['note', id],
    queryFn: async () => {
      const { data } = await api.get<Note>(`/notes/${id}`);
      return data;
    },
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (isError && id) {
      toast.error('Note not found.');
      navigate('/notes');
    }
  }, [isError, id, navigate]);

  // ── Draft recovery toast (shown once per note load) ───────────────────────
  useEffect(() => {
    if (!id || !note || draftToastShownRef.current) return;
    const draft = useDraftStore.getState().drafts[id];
    if (!draft) return;

    draftToastShownRef.current = true;

    toast('You have an unsaved draft — restore it?', {
      duration: Infinity,
      action: {
        label: 'Restore',
        onClick: () => setDraftToRestore(draft),
      },
      cancel: {
        label: 'Dismiss',
        onClick: () => clearDraft(id),
      },
    });
  }, [id, note, clearDraft]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isNew) {
    return <NoteEditor note={NEW_NOTE_STUB} />;
  }

  if (isLoading) {
    return <EditorSkeleton />;
  }

  if (!note) {
    return null;
  }

  return (
    <NoteEditor
      note={note}
      draftToRestore={draftToRestore ?? undefined}
      onDraftConsumed={() => setDraftToRestore(null)}
    />
  );
}
