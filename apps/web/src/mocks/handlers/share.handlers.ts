import { http, HttpResponse } from 'msw';
import type { ShareLink } from '@/types/shares';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function makeShareLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'share-1',
    token: 'abc123def456a3f9c2',
    shareUrl: 'http://localhost:3000/public/shares/abc123def456a3f9c2',
    expiresAt: null,
    revokedAt: null,
    viewCount: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const activeLink = makeShareLink();
const revokedLink = makeShareLink({
  id: 'share-2',
  token: 'xyz789uvw012b7e4d1',
  shareUrl: 'http://localhost:3000/public/shares/xyz789uvw012b7e4d1',
  revokedAt: new Date().toISOString(),
  viewCount: 7,
});

export const shareHandlers = [
  // DELETE must come before the GET list handler so MSW doesn't shadow it
  http.delete(`${BASE}/notes/:noteId/shares/:token`, ({ params }) => {
    const { token } = params as { token: string };

    if (token === 'bad-token') {
      return HttpResponse.json(
        { code: 'SHARE_NOT_FOUND', message: 'Share link not found' },
        { status: 404 },
      );
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/notes/:noteId/shares`, ({ params }) => {
    const { noteId } = params as { noteId: string };

    if (noteId === 'note-empty') {
      return HttpResponse.json([]);
    }

    return HttpResponse.json([activeLink, revokedLink]);
  }),

  http.post(`${BASE}/notes/:noteId/shares`, async ({ params, request }) => {
    const { noteId } = params as { noteId: string };

    if (noteId === 'note-fail-share') {
      return HttpResponse.json({ code: 'INTERNAL_ERROR', message: 'Server error' }, { status: 500 });
    }

    const body = (await request.json()) as { expiresAt?: string };
    return HttpResponse.json(
      makeShareLink({ expiresAt: body.expiresAt ?? null }),
      { status: 201 },
    );
  }),
];
