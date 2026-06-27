import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useMinDuration } from '@/hooks/useMinDuration';
import { Button } from '@/components/ui/button';
import { NoteCard, NoteCardSkeleton } from './NoteCard';
import { NotesEmptyState } from './NotesEmptyState';
import type { Note, PaginatedNotes } from '@/types/notes';

interface NotesListProps {
  sort: string;
  tagIds: string[];
  onClearTagFilter: () => void;
}

function fetchNotesPage({
  sort,
  tagIds,
  cursor,
}: {
  sort: string;
  tagIds: string[];
  cursor?: string;
}): Promise<PaginatedNotes> {
  const params: Record<string, string> = { sort, limit: '20' };
  if (tagIds.length > 0) params.tagIds = tagIds.join(',');
  if (cursor) params.cursor = cursor;
  return api.get<PaginatedNotes>('/notes', { params }).then((r) => r.data);
}

export function NotesList({ sort, tagIds, onClearTagFilter }: NotesListProps) {
  const sortedTagIds = [...tagIds].sort();

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['notes', sort, sortedTagIds],
    queryFn: ({ pageParam }) =>
      fetchNotesPage({ sort, tagIds: sortedTagIds, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  useEffect(() => {
    if (isError && isAxiosError(error) && error.response?.data?.code === 'INVALID_TAG') {
      toast.error(getErrorMessage('INVALID_TAG'));
      onClearTagFilter();
    }
  }, [isError, error, onClearTagFilter]);

  const showLoadMoreSpinner = useMinDuration(isFetchingNextPage, 200);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <NoteCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError && (!isAxiosError(error) || error.response?.data?.code !== 'INVALID_TAG')) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          Couldn&apos;t load your notes. Check your connection.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const notes: Note[] = (data?.pages ?? []).flatMap((p) =>
    p.items.filter((n) => !n.deletedAt),
  );

  if (notes.length === 0) {
    return <NotesEmptyState variant={tagIds.length > 0 ? 'no-match' : 'empty'} />;
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="min-w-[120px]"
          >
            {showLoadMoreSpinner ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
