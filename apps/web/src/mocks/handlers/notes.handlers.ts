import { http, HttpResponse } from 'msw';
import type { Note, Tag, PaginatedNotes } from '@/types/notes';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const MOCK_TAGS: Tag[] = [
  { id: 'tag-1', name: 'Work', color: '#3b82f6', noteCount: 3 },
  { id: 'tag-2', name: 'Personal', color: '#10b981', noteCount: 2 },
  { id: 'tag-3', name: 'Ideas', color: '#f59e0b', noteCount: 1 },
];

function makeMockNote(i: number, overrides: Partial<Note> = {}): Note {
  return {
    id: `note-${i}`,
    title: `Note ${i}`,
    body: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: `Body of note ${i}` }],
        },
      ],
    },
    tagIds: i % 3 === 0 ? ['tag-1'] : [],
    tags: i % 3 === 0 ? [MOCK_TAGS[0]!] : [],
    createdAt: new Date(Date.now() - i * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - i * 30_000).toISOString(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

const ALL_NOTES: Note[] = Array.from({ length: 25 }, (_, i) => makeMockNote(i + 1));

export const notesHandlers = [
  http.get(`${BASE}/notes`, ({ request }) => {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const tagIds = url.searchParams.get('tagIds');

    // Return empty list for specific test tag IDs to simulate no-match
    if (tagIds === 'tag-empty') {
      return HttpResponse.json({ items: [], nextCursor: null } satisfies PaginatedNotes);
    }

    let notes = ALL_NOTES;

    if (tagIds) {
      const ids = tagIds.split(',');
      notes = notes.filter((n) => ids.every((id) => n.tagIds.includes(id)));
    }

    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const page = notes.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const nextCursor = nextIndex < notes.length ? String(nextIndex) : null;

    return HttpResponse.json({ items: page, nextCursor } satisfies PaginatedNotes);
  }),

  http.get(`${BASE}/tags`, () => {
    return HttpResponse.json(MOCK_TAGS);
  }),
];
