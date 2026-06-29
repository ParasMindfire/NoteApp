/**
 * Tests for ShareModal component family
 * Scenarios: UI-SHARE-OPEN-S1, UI-SHARE-OPEN-S2,
 *            UI-SHARE-LIST-S1, UI-SHARE-LIST-S2,
 *            UI-SHARE-CREATE-S1, UI-SHARE-CREATE-S2, UI-SHARE-CREATE-S3,
 *            UI-SHARE-REVOKE-S1, UI-SHARE-REVOKE-S2
 * FRs: FR-UI-SHARE-1, FR-UI-SHARE-2, FR-UI-SHARE-3, FR-UI-SHARE-4
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { NoteCard } from '@/components/notes/NoteCard';
import { ShareModal } from '@/components/share/ShareModal';
import type { Note } from '@/types/notes';
import type { ShareLink } from '@/types/shares';

// Must match VITE_API_URL in apps/web/.env (used by api.ts and mocks/handlers)
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Mock sonner so we can assert on toast calls
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

// We import toast AFTER the mock so we get the mocked version in tests
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Polyfills for jsdom
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const MOCK_NOTE: Note = {
  id: 'note-1',
  title: 'Test Note',
  body: { type: 'doc', content: [] },
  tagIds: [],
  tags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  version: 1,
};


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

/** Render NoteCard (contains Share button + ShareModal) */
function renderNoteCard(note: Note = MOCK_NOTE, qc?: QueryClient) {
  const client = qc ?? makeQueryClient();
  return {
    qc: client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NoteCard note={note} />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

/** Render ShareModal directly with controlled open state */
function renderShareModal(
  props: { noteId?: string; open?: boolean; onOpenChange?: (v: boolean) => void },
  qc?: QueryClient,
) {
  const client = qc ?? makeQueryClient();
  const { noteId = 'note-1', open = true, onOpenChange = vi.fn() } = props;
  return {
    qc: client,
    onOpenChange,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ShareModal noteId={noteId} open={open} onOpenChange={onOpenChange} />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
describe('ShareModal', () => {
  // -------------------------------------------------------------------------
  // UI-SHARE-OPEN-S1 — Share button opens modal; ESC closes; aria-label
  // FR-UI-SHARE-1
  // -------------------------------------------------------------------------
  it('UI-SHARE-OPEN-S1: share button on NoteCard opens modal; ESC closes it; aria-label present', async () => {
    renderNoteCard();

    // Share button must be present with correct aria-label
    const shareBtn = screen.getByRole('button', { name: /share note/i });
    expect(shareBtn).toBeInTheDocument();

    // Modal not visible before click
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open modal
    await userEvent.click(shareBtn);

    // Dialog is now visible
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // ESC closes the modal
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-OPEN-S2 — Share button in NoteEditor opens modal
  // FR-UI-SHARE-1
  // (NoteEditor is heavy; we test the modal directly with a controlled open prop)
  // -------------------------------------------------------------------------
  it('UI-SHARE-OPEN-S2: ShareModal renders with correct noteId when opened from editor context', async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${BASE}/notes/:noteId/shares`, ({ request }) => {
        requests.push(request);
        // Return empty list for any noteId — we only care that the correct ID is used
        return HttpResponse.json([] satisfies ShareLink[]);
      })
    );

    const editorNoteId = 'editor-note-42';
    renderShareModal({ noteId: editorNoteId, open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Verify the GET request used the correct noteId
    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe(`/notes/${editorNoteId}/shares`);
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-LIST-S1 — Active + revoked links displayed correctly
  // FR-UI-SHARE-2
  // -------------------------------------------------------------------------
  it('UI-SHARE-LIST-S1: active and revoked share links rendered with correct visual distinction', async () => {
    // Default handler returns [activeLink, revokedLink] for note-1
    renderShareModal({ noteId: 'note-1', open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Wait for both share link cards to appear
    await waitFor(() => {
      const cards = screen.getAllByTestId('share-link-card');
      expect(cards).toHaveLength(2);
    });

    const cards = screen.getAllByTestId('share-link-card');

    // Active link card (first) — token tail "a3f9c2", Revoke button visible
    const activeCard = cards[0]!;
    expect(within(activeCard).getByText(/…a3f9c2/)).toBeInTheDocument();
    expect(within(activeCard).getByRole('button', { name: /revoke share link/i })).toBeInTheDocument();
    // No "Revoked" badge on active link
    expect(within(activeCard).queryByText('Revoked')).not.toBeInTheDocument();
    // Not greyed out
    expect(activeCard).not.toHaveClass('opacity-50');

    // Revoked link card (second) — has opacity-50, "Revoked" badge, no Revoke button
    const revokedCard = cards[1]!;
    expect(within(revokedCard).getByText('Revoked')).toBeInTheDocument();
    expect(revokedCard).toHaveClass('opacity-50');
    expect(within(revokedCard).queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();

    // viewCount shown on active card
    expect(within(activeCard).getByText(/3 view/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-LIST-S2 — Empty state shown when no links exist
  // FR-UI-SHARE-2
  // -------------------------------------------------------------------------
  it('UI-SHARE-LIST-S2: empty state shown when note has no share links', async () => {
    // note-empty returns [] from MSW handler
    renderShareModal({ noteId: 'note-empty', open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/no active share links/i)).toBeInTheDocument();
    });

    // "Generate one below" hint visible
    expect(screen.getByText(/generate one below/i)).toBeInTheDocument();

    // ShareGenerateForm still visible (the "Generate link" button)
    expect(screen.getByRole('button', { name: /generate link/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-CREATE-S1 — Generate link without expiry; clipboard copy; success toast; list refresh
  // FR-UI-SHARE-3
  // -------------------------------------------------------------------------
  it('UI-SHARE-CREATE-S1: generate link copies URL to clipboard and shows success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const postRequests: { url: string; body: unknown }[] = [];
    server.use(
      http.post(`${BASE}/notes/:noteId/shares`, async ({ request }) => {
        const body = await request.json();
        postRequests.push({ url: request.url, body });
        return HttpResponse.json(
          makeShareLink({ shareUrl: 'http://localhost:3000/public/shares/newtoken' }),
          { status: 201 }
        );
      })
    );

    renderShareModal({ noteId: 'note-1', open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /generate link/i });
    await userEvent.click(generateBtn);

    // POST was called with empty body (no expiresAt)
    await waitFor(() => {
      expect(postRequests).toHaveLength(1);
    });
    expect(postRequests[0]!.body).toEqual({});

    // Clipboard writeText called with the share URL
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('http://localhost:3000/public/shares/newtoken');
    });

    // Success toast shown
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard');
    });
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-CREATE-S2 — Generate link with expiry date; POST body includes expiresAt
  // FR-UI-SHARE-3
  // -------------------------------------------------------------------------
  it('UI-SHARE-CREATE-S2: generate link with expiry date sends expiresAt in POST body', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const postRequests: { body: unknown }[] = [];
    server.use(
      http.post(`${BASE}/notes/:noteId/shares`, async ({ request }) => {
        const body = await request.json();
        postRequests.push({ body });
        return HttpResponse.json(
          makeShareLink({
            expiresAt: (body as { expiresAt?: string }).expiresAt ?? null,
          }),
          { status: 201 }
        );
      })
    );

    renderShareModal({ noteId: 'note-1', open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Set a future date in the expiry date input
    const futureDate = '2099-12-31';
    const dateInput = screen.getByLabelText(/share link expiry date/i);
    fireEvent.change(dateInput, { target: { value: futureDate } });

    const generateBtn = screen.getByRole('button', { name: /generate link/i });
    await userEvent.click(generateBtn);

    // POST body must include expiresAt as an ISO 8601 string
    await waitFor(() => {
      expect(postRequests).toHaveLength(1);
    });

    const body = postRequests[0]!.body as { expiresAt?: string };
    expect(body.expiresAt).toBeDefined();
    // Verify it is an ISO 8601 date string derived from the selected date
    expect(new Date(body.expiresAt!).getFullYear()).toBe(2099);
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-CREATE-S3 — Clipboard unavailable; toast.error with exact message; fallback input shown
  // FR-UI-SHARE-3 (decision 2)
  // -------------------------------------------------------------------------
  it('UI-SHARE-CREATE-S3: clipboard failure shows error toast then fallback read-only input', async () => {
    // Make clipboard.writeText throw
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
      writable: true,
      configurable: true,
    });

    const shareUrl = 'http://localhost:3000/public/shares/fallbacktoken';
    server.use(
      http.post(`${BASE}/notes/:noteId/shares`, async () => {
        return HttpResponse.json(
          makeShareLink({ token: 'fallbacktoken123456', shareUrl }),
          { status: 201 }
        );
      })
    );

    renderShareModal({ noteId: 'note-1', open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /generate link/i });
    await userEvent.click(generateBtn);

    // toast.error must be called with the exact message BEFORE the fallback input appears
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't copy link — copy it manually:");
    });

    // Fallback read-only input must appear with the shareUrl value
    await waitFor(() => {
      const fallbackInput = screen.getByRole('textbox', { name: /share link url/i });
      expect(fallbackInput).toBeInTheDocument();
      expect(fallbackInput).toHaveAttribute('readonly');
      expect(fallbackInput).toHaveValue(shareUrl);
    });
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-REVOKE-S1 — Revoke click → confirm dialog → confirm → DELETE called; link greyed out
  // FR-UI-SHARE-4
  // -------------------------------------------------------------------------
  it('UI-SHARE-REVOKE-S1: revoke button opens confirm dialog; confirming calls DELETE and link becomes revoked', async () => {
    const deleteRequests: string[] = [];

    // After revoke, return the link as revoked so list refresh shows greyed-out state
    let revokedState = false;
    server.use(
      http.delete(`${BASE}/notes/:noteId/shares/:token`, ({ params }) => {
        deleteRequests.push((params as { token: string }).token);
        revokedState = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${BASE}/notes/:noteId/shares`, ({ params }) => {
        const { noteId } = params as { noteId: string };
        if (noteId !== 'note-1') return HttpResponse.json([]);
        const activeLink = makeShareLink();
        if (revokedState) {
          return HttpResponse.json([
            { ...activeLink, revokedAt: new Date().toISOString() },
          ] satisfies ShareLink[]);
        }
        return HttpResponse.json([activeLink] satisfies ShareLink[]);
      }),
    );

    renderShareModal({ noteId: 'note-1', open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Wait for the active link card's Revoke button
    await waitFor(() => {
      expect(screen.getAllByTestId('share-link-card')).toHaveLength(1);
    });

    const revokeBtn = screen.getByRole('button', { name: /revoke share link/i });
    await userEvent.click(revokeBtn);

    // RevokeConfirmDialog must appear — query DialogTitle and DialogDescription separately
    await waitFor(() => {
      expect(screen.getByText('Revoke this share link?')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Anyone with the link will no longer be able to view this note.')
    ).toBeInTheDocument();

    // Click the destructive Revoke confirm button
    const confirmBtn = screen.getByRole('button', { name: /confirm revoke/i });
    await userEvent.click(confirmBtn);

    // DELETE /notes/:id/shares/:token must have been called
    await waitFor(() => {
      expect(deleteRequests).toHaveLength(1);
    });
    expect(deleteRequests[0]).toBe('abc123def456a3f9c2');

    // After list refresh, the card should be greyed out (opacity-50) and show "Revoked" badge
    await waitFor(() => {
      const cards = screen.getAllByTestId('share-link-card');
      expect(cards[0]).toHaveClass('opacity-50');
      expect(within(cards[0]!).getByText('Revoked')).toBeInTheDocument();
    });

    // Confirm dialog must close
    await waitFor(() => {
      expect(screen.queryByText('Revoke this share link?')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // UI-SHARE-REVOKE-S2 — Cancel confirm; DELETE not called; share modal still open
  // FR-UI-SHARE-4
  // -------------------------------------------------------------------------
  it('UI-SHARE-REVOKE-S2: cancel in confirm dialog does not call DELETE; share modal stays open', async () => {
    const deleteRequests: string[] = [];
    server.use(
      http.delete(`${BASE}/notes/:noteId/shares/:token`, ({ params }) => {
        deleteRequests.push((params as { token: string }).token);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderShareModal({ noteId: 'note-1', open: true });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Wait for the active link card
    await waitFor(() => {
      expect(screen.getAllByTestId('share-link-card')).toHaveLength(2);
    });

    const revokeBtn = screen.getByRole('button', { name: /revoke share link ending in a3f9c2/i });
    await userEvent.click(revokeBtn);

    // Confirm dialog appears
    await waitFor(() => {
      expect(screen.getByText('Revoke this share link?')).toBeInTheDocument();
    });

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    // Confirm dialog closes
    await waitFor(() => {
      expect(screen.queryByText('Revoke this share link?')).not.toBeInTheDocument();
    });

    // DELETE was NOT called
    expect(deleteRequests).toHaveLength(0);

    // Share modal is still open — the dialog role is still present
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
