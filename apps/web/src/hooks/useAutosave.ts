import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useEditorStatusStore } from '@/stores/editorStatusStore';
import { useDraftStore } from '@/stores/draftStore';
import type { Note } from '@/types/notes';

export interface AutosaveData {
  title: string;
  body: Record<string, unknown>;
  tagIds: string[];
}

interface UseAutosaveOptions {
  noteId: string | undefined;
  onSuccess?: (note: Note) => void;
}

export function useAutosave({ noteId, onSuccess }: UseAutosaveOptions) {
  const setStatus = useEditorStatusStore((s) => s.setStatus);
  const setDraft = useDraftStore((s) => s.setDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureCountRef = useRef(0);
  const lastDataRef = useRef<AutosaveData | null>(null);

  const save = useCallback(
    async (data: AutosaveData) => {
      if (!noteId) return;
      lastDataRef.current = data;
      setStatus('saving');
      try {
        const res = await api.patch<Note>(`/notes/${noteId}`, data);
        failureCountRef.current = 0;
        clearDraft(noteId);
        setStatus('saved');
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 3000);
        onSuccess?.(res.data);
      } catch {
        failureCountRef.current += 1;
        if (failureCountRef.current >= 2) {
          setStatus('error');
          toast.error("Couldn't save your changes");
          setDraft(noteId, data);
          failureCountRef.current = 0;
        } else {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => save(data), 5000);
        }
      }
    },
    [noteId, setStatus, clearDraft, setDraft, onSuccess],
  );

  const scheduleAutoSave = useCallback(
    (data: AutosaveData) => {
      if (!noteId) return;
      if (data.title.length < 1 || data.title.length > 200) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => save(data), 2000);
    },
    [noteId, save],
  );

  const retryNow = useCallback(() => {
    if (!lastDataRef.current) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    failureCountRef.current = 0;
    save(lastDataRef.current);
  }, [save]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  return { scheduleAutoSave, retryNow };
}
