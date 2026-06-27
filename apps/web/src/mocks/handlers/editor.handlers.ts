import { http, HttpResponse } from 'msw';
import type { Note, Tag } from '@/types/notes';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function makeMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Test Note',
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
    tagIds: [],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeMockTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: `tag-new-${Date.now()}`,
    name: 'new-tag',
    color: '#3b82f6',
    noteCount: 0,
    ...overrides,
  };
}

export const editorHandlers = [
  // GET /notes/:id — return mock note; 404 for id "note-missing"
  http.get(`${BASE}/notes/:id`, ({ params }) => {
    const { id } = params as { id: string };

    if (id === 'note-missing') {
      return HttpResponse.json(
        { code: 'NOTE_NOT_FOUND', message: 'Note not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json(makeMockNote({ id }));
  }),

  // POST /notes — create new note; returns 201 with note-new-1 id
  http.post(`${BASE}/notes`, async ({ request }) => {
    const body = (await request.json()) as Partial<Note>;
    return HttpResponse.json(
      makeMockNote({ id: 'note-new-1', title: body.title ?? 'Untitled', tagIds: body.tagIds ?? [] }),
      { status: 201 },
    );
  }),

  // PATCH /notes/:id — update note; error for id "note-fail"
  http.patch(`${BASE}/notes/:id`, async ({ params, request }) => {
    const { id } = params as { id: string };

    if (id === 'note-fail') {
      return HttpResponse.json(
        { code: 'INTERNAL_ERROR', message: 'Simulated save failure' },
        { status: 500 },
      );
    }

    const body = (await request.json()) as Partial<Note>;
    return HttpResponse.json(
      makeMockNote({
        id,
        title: body.title,
        body: body.body ?? { type: 'doc', content: [] },
        tagIds: body.tagIds ?? [],
        version: 2,
        updatedAt: new Date().toISOString(),
      }),
    );
  }),

  // POST /tags — create tag; 409 for name "duplicate-tag"
  http.post(`${BASE}/tags`, async ({ request }) => {
    const body = (await request.json()) as { name: string; color: string };

    if (body.name === 'duplicate-tag') {
      return HttpResponse.json(
        { code: 'TAG_NAME_DUPLICATE', message: 'Tag name already exists' },
        { status: 409 },
      );
    }

    return HttpResponse.json(
      makeMockTag({ name: body.name, color: body.color }),
      { status: 201 },
    );
  }),
];
