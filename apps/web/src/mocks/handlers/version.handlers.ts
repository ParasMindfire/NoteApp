import { http, HttpResponse } from 'msw';
import type { NoteVersion, NoteVersionSummary } from '@/types/versions';
import type { Note } from '@/types/notes';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const now = new Date().toISOString();

const FIXTURE_VERSIONS: NoteVersionSummary[] = [
  { id: 'ver-3', version: 3, title: 'My Note (v3)', savedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
  { id: 'ver-2', version: 2, title: 'My Note (v2)', savedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
  { id: 'ver-1', version: 1, title: 'My Note (v1)', savedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
];

const RESTORED_NOTE: Note = {
  id: 'note-1',
  title: 'My Note (v2)',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version 2 content' }] }] },
  tagIds: [],
  tags: [],
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  version: 5,
};

export const versionHandlers = [
  http.get(`${BASE}/notes/:noteId/versions`, ({ params }) => {
    const { noteId } = params as { noteId: string };

    if (noteId === 'note-no-versions') {
      return HttpResponse.json([] satisfies NoteVersionSummary[]);
    }

    return HttpResponse.json(FIXTURE_VERSIONS satisfies NoteVersionSummary[]);
  }),

  http.get(`${BASE}/notes/:noteId/versions/:versionId`, ({ params }) => {
    const { versionId } = params as { versionId: string };

    if (versionId === 'bad-version-id') {
      return HttpResponse.json(
        { code: 'VERSION_NOT_FOUND', message: 'Version not found' },
        { status: 404 },
      );
    }

    const version = FIXTURE_VERSIONS.find((v) => v.id === versionId);
    if (!version) {
      return HttpResponse.json(
        { code: 'VERSION_NOT_FOUND', message: 'Version not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      ...version,
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${version.title} content` }] }] },
    } satisfies NoteVersion);
  }),

  http.post(`${BASE}/notes/:noteId/versions/:versionId/restore`, ({ params }) => {
    const { versionId } = params as { versionId: string };

    if (versionId === 'bad-version-id') {
      return HttpResponse.json(
        { code: 'VERSION_NOT_FOUND', message: 'Version not found' },
        { status: 404 },
      );
    }

    return HttpResponse.json(RESTORED_NOTE satisfies Note);
  }),
];
