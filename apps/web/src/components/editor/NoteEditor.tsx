import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { useMutation } from '@tanstack/react-query';
import StarterKit from '@tiptap/starter-kit';
import { Share2, History, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EditorToolbar } from './EditorToolbar';
import { EditorStatusIndicator } from './EditorStatusIndicator';
import { TagCombobox } from './TagCombobox';
import { useAutosave } from '@/hooks/useAutosave';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { ShareModal } from '@/components/share/ShareModal';
import { HistoryDrawer } from '@/components/history/HistoryDrawer';
import { DeleteNoteDialog } from '@/components/notes/DeleteNoteDialog';
import type { Note } from '@/types/notes';
import type { Draft } from '@/stores/draftStore';

interface NoteEditorProps {
  note: Note;
  draftToRestore?: Draft;
  onDraftConsumed?: () => void;
}

export function NoteEditor({ note, draftToRestore, onDraftConsumed }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>(note.tagIds);
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/notes/${note.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note moved to trash');
      navigate('/notes');
    },
    onError: () => {
      toast.error('Failed to delete note');
    },
  });

  const titleRef = useRef(note.title);
  const tagIdsRef = useRef(note.tagIds);
  const bodyRef = useRef<Record<string, unknown>>(note.body as Record<string, unknown>);

  const { scheduleAutoSave, retryNow } = useAutosave({ noteId: note.id });

  // Keep ref current so editor onUpdate can read latest without stale closure
  const scheduleRef = useRef(scheduleAutoSave);
  scheduleRef.current = scheduleAutoSave;

  const editor = useEditor({
    extensions: [StarterKit],
    content: note.body,
    onUpdate: ({ editor: e }) => {
      bodyRef.current = e.getJSON() as Record<string, unknown>;
      scheduleRef.current({
        title: titleRef.current,
        body: bodyRef.current,
        tagIds: tagIdsRef.current,
      });
    },
  });

  // Restore draft content when signalled from parent
  useEffect(() => {
    if (!draftToRestore) return;
    setTitle(draftToRestore.title);
    titleRef.current = draftToRestore.title;
    setTagIds(draftToRestore.tagIds);
    tagIdsRef.current = draftToRestore.tagIds;
    bodyRef.current = draftToRestore.body;
    editor?.commands.setContent(draftToRestore.body);
    onDraftConsumed?.();
  }, [draftToRestore, editor, onDraftConsumed]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTitle(value);
    titleRef.current = value;
    if (titleError) setTitleError(null);
    scheduleRef.current({ title: value, body: bodyRef.current, tagIds: tagIdsRef.current });
  }, [titleError]);

  function handleTitleBlur() {
    if (title.length < 1 || title.length > 200) {
      setTitleError('Title must be between 1 and 200 characters');
    } else {
      setTitleError(null);
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus();
    }
  }

  const handleTagsChange = useCallback((newTagIds: string[]) => {
    setTagIds(newTagIds);
    tagIdsRef.current = newTagIds;
    scheduleRef.current({ title: titleRef.current, body: bodyRef.current, tagIds: newTagIds });
  }, []);

  const handleRestore = useCallback(
    (restoredNote: Note) => {
      setTitle(restoredNote.title);
      titleRef.current = restoredNote.title;
      editor?.commands.setContent(restoredNote.body);
      bodyRef.current = restoredNote.body as Record<string, unknown>;
      queryClient.invalidateQueries({ queryKey: ['note', note.id] });
    },
    [editor, note.id],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Editor header bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <EditorToolbar editor={editor} />
        <div className="flex items-center gap-2">
          <EditorStatusIndicator onRetry={retryNow} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Share note"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Version history"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
          </Button>
          {note.id && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Delete note"
              onClick={() => setDeleteOpen(true)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-6 pb-2 pt-6">
        <Input
          value={title}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="Note title"
          aria-label="Note title"
          aria-invalid={!!titleError}
          aria-describedby={titleError ? 'title-error' : undefined}
          className={cn(
            'border-none px-0 text-2xl font-bold shadow-none focus-visible:ring-0',
            titleError && 'border border-destructive ring-1 ring-destructive',
          )}
        />
        {titleError && (
          <p id="title-error" className="mt-1 text-sm text-destructive">
            {titleError}
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="px-6 pb-3">
        <TagCombobox tagIds={tagIds} onChange={handleTagsChange} />
      </div>

      {/* TipTap body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none focus:outline-none"
          data-testid="editor-content"
        />
      </div>

      <ShareModal noteId={note.id} open={shareOpen} onOpenChange={setShareOpen} />
      <HistoryDrawer
        noteId={note.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        currentTitle={title}
        currentBody={bodyRef.current}
        onRestore={handleRestore}
      />
      <DeleteNoteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        noteTitle={title}
      />
    </div>
  );
}
