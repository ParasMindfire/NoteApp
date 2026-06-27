import { useInfiniteQuery } from '@tanstack/react-query';
import { SearchX, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { SearchResultCard } from './SearchResultCard';
import type { PaginatedSearchResults } from '@/types/notes';
import { getErrorMessage } from '@/lib/errorMessages';
import { toast } from 'sonner';
import { useEffect } from 'react';

interface SearchResultsListProps {
  query: string;
}

export function SearchResultsList({ query }: SearchResultsListProps) {
  const { data, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: ['search', query],
      queryFn: ({ pageParam }) =>
        api
          .get<PaginatedSearchResults>('/search', {
            params: {
              q: query,
              ...(pageParam ? { cursor: pageParam } : {}),
              limit: 20,
            },
          })
          .then((r) => r.data),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: query.length > 0,
    });

  useEffect(() => {
    if (isError) {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      toast.error(getErrorMessage(code ?? 'SEARCH_FAILED'));
    }
  }, [isError, error]);

  if (!query) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-4 flex flex-col gap-3" aria-busy="true" aria-label="Loading search results">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  if (allItems.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-foreground">
          No matches for &apos;{query}&apos;
        </h2>
        <p className="text-sm text-muted-foreground">Try different keywords</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3">
        {allItems.map((result) => (
          <SearchResultCard key={result.note.id} result={result} />
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
