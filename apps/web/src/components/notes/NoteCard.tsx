import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { extractPlainText } from '@/lib/noteUtils';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { TagChip } from './TagChip';
import { ShareModal } from '@/components/share/ShareModal';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import type { Note } from '@/types/notes';

interface NoteCardProps {
  note: Note;
}

export function NoteCard({ note }: NoteCardProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const preview = extractPlainText(note.body);
  const updatedAgo = formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/notes/${note.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note moved to trash');
      setDeleteOpen(false);
    },
    onError: () => {
      toast.error('Failed to delete note');
    },
  });

  return (
    <article className="relative rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link
        to={`/notes/${note.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Open note: ${note.title}`}
      >
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-card-foreground">
          {note.title}
        </h3>
        {preview && (
          <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{preview}</p>
        )}
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 overflow-hidden">
          {(note.tags ?? []).map((tag) => (
            <TagChip key={tag.id} id={tag.id} name={tag.name} color={tag.color} readonly />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{updatedAgo}</span>
          <button
            type="button"
            aria-label="Delete note"
            onClick={() => setDeleteOpen(true)}
            className="rounded p-1 text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Share note"
            onClick={() => setShareOpen(true)}
            className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ShareModal noteId={note.id} open={shareOpen} onOpenChange={setShareOpen} />
      <DeleteNoteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        noteTitle={note.title}
      />
    </article>
  );
}

export function NoteCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mb-1 h-3 w-full animate-pulse rounded bg-muted" />
      <div className="mb-3 h-3 w-2/3 animate-pulse rounded bg-muted" />
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
