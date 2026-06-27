import { http, HttpResponse } from 'msw';
import type { SearchResult, PaginatedSearchResults } from '@/types/notes';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const MOCK_NOTES = Array.from({ length: 15 }, (_, i) => ({
  id: `search-note-${i + 1}`,
  title: `Search Note ${i + 1}`,
  body: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: `Body of search note ${i + 1}` }] }],
  },
  tagIds: [],
  tags: [],
  createdAt: new Date(Date.now() - i * 60_000).toISOString(),
  updatedAt: new Date(Date.now() - i * 30_000).toISOString(),
  deletedAt: null,
  version: 1,
}));

export const searchHandlers = [
  http.get(`${BASE}/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const cursor = url.searchParams.get('cursor');
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    if (!q) {
      return HttpResponse.json({ items: [], nextCursor: null } satisfies PaginatedSearchResults);
    }

    if (q === 'empty-query-test') {
      return HttpResponse.json({ items: [], nextCursor: null } satisfies PaginatedSearchResults);
    }

    if (q === 'xss-test') {
      const item: SearchResult = {
        note: MOCK_NOTES[0]!,
        headline: '<script>alert(1)</script> some text',
      };
      return HttpResponse.json({ items: [item], nextCursor: null } satisfies PaginatedSearchResults);
    }

    const matched = MOCK_NOTES.filter((n) =>
      n.title.toLowerCase().includes(q.toLowerCase()),
    );

    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const page = matched.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const nextCursor = nextIndex < matched.length ? String(nextIndex) : null;

    const items: SearchResult[] = page.map((note) => ({
      note,
      headline: note.title.replace(
        new RegExp(`(${q})`, 'gi'),
        '<mark>$1</mark>',
      ),
    }));

    return HttpResponse.json({ items, nextCursor } satisfies PaginatedSearchResults);
  }),
];
