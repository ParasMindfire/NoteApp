/**
 * Unit tests for notes.controller.ts
 *
 * The notes service is mocked — no DB or HTTP layer needed.
 *
 * Coverage:
 *   CTRL-NOTE-C1 → FR-NOTE-1: createNoteController valid body → calls createNote, returns 201 + note
 *   CTRL-NOTE-C2 → FR-NOTE-1: createNoteController missing title → throws AppError 400 VALIDATION_FAILED
 *   CTRL-NOTE-G1 → FR-NOTE-2: getNoteController valid params.id → calls getNoteById, returns 200 + note
 *   CTRL-NOTE-U1 → FR-NOTE-3: updateNoteController valid body → calls updateNote, returns 200 + note
 *   CTRL-NOTE-U2 → FR-NOTE-3: updateNoteController empty body → throws AppError 400 VALIDATION_FAILED
 *   CTRL-NOTE-D1 → FR-NOTE-4: deleteNoteController valid params.id → calls deleteNote, returns 204
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import {
  createNoteController,
  getNoteController,
  updateNoteController,
  deleteNoteController,
} from '../controllers/notes.controller.js';

// ---------------------------------------------------------------------------
// Mock the notes service
// ---------------------------------------------------------------------------

vi.mock('../services/notes.service.js', () => ({
  createNote: vi.fn(),
  getNoteById: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

import {
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
} from '../services/notes.service.js';

// ---------------------------------------------------------------------------
// Mock req/res helpers
// ---------------------------------------------------------------------------

const mockRes = () => {
  const res = {} as unknown as Response;
  (res as Record<string, unknown>).status = vi.fn().mockReturnValue(res);
  (res as Record<string, unknown>).json = vi.fn().mockReturnValue(res);
  (res as Record<string, unknown>).end = vi.fn().mockReturnValue(res);
  (res as Record<string, unknown>).locals = { userId: 'user-1' };
  return res;
};

const mockReq = (body = {}, params = {}) => ({ body, params } as unknown as Request);

// ---------------------------------------------------------------------------
// Sample fixtures
// ---------------------------------------------------------------------------

const SAMPLE_NOTE = {
  id: 'note-1',
  title: 'Test Note',
  body: { type: 'doc', content: [] },
  tagIds: [],
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const VALID_CREATE_BODY = {
  title: 'Test Note',
  body: { type: 'doc', content: [] },
};

const VALID_UPDATE_BODY = {
  title: 'Updated Title',
};

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// CTRL-NOTE-C1: createNoteController — valid body → 201 + note
// FR-NOTE-1
// ---------------------------------------------------------------------------

describe('CTRL-NOTE-C1: createNoteController valid body (FR-NOTE-1)', () => {
  it('CTRL-NOTE-C1: calls createNote(userId, data) and responds 201 with note', async () => {
    (createNote as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SAMPLE_NOTE);

    const req = mockReq(VALID_CREATE_BODY);
    const res = mockRes();

    await createNoteController(req, res);

    expect(createNote).toHaveBeenCalledOnce();
    expect(createNote).toHaveBeenCalledWith('user-1', {
      title: VALID_CREATE_BODY.title,
      body: VALID_CREATE_BODY.body,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(SAMPLE_NOTE);
  });
});

// ---------------------------------------------------------------------------
// CTRL-NOTE-C2: createNoteController — missing title → AppError 400 VALIDATION_FAILED
// FR-NOTE-1
// ---------------------------------------------------------------------------

describe('CTRL-NOTE-C2: createNoteController missing title (FR-NOTE-1)', () => {
  it('CTRL-NOTE-C2: throws AppError 400 VALIDATION_FAILED when title is absent', async () => {
    const req = mockReq({ body: { type: 'doc', content: [] } }); // no title at top level
    const res = mockRes();

    await expect(createNoteController(req, res)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    } satisfies Partial<AppError>);

    expect(createNote).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CTRL-NOTE-G1: getNoteController — valid params.id → 200 + note
// FR-NOTE-2
// ---------------------------------------------------------------------------

describe('CTRL-NOTE-G1: getNoteController valid params.id (FR-NOTE-2)', () => {
  it('CTRL-NOTE-G1: calls getNoteById(userId, noteId) and responds 200 with note', async () => {
    (getNoteById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SAMPLE_NOTE);

    const req = mockReq({}, { id: 'note-1' });
    const res = mockRes();

    await getNoteController(req, res);

    expect(getNoteById).toHaveBeenCalledOnce();
    expect(getNoteById).toHaveBeenCalledWith('user-1', 'note-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(SAMPLE_NOTE);
  });
});

// ---------------------------------------------------------------------------
// CTRL-NOTE-U1: updateNoteController — valid body → 200 + note
// FR-NOTE-3
// ---------------------------------------------------------------------------

describe('CTRL-NOTE-U1: updateNoteController valid body (FR-NOTE-3)', () => {
  it('CTRL-NOTE-U1: calls updateNote(userId, noteId, data) and responds 200 with note', async () => {
    const updatedNote = { ...SAMPLE_NOTE, title: 'Updated Title', version: 2 };
    (updateNote as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedNote);

    const req = mockReq(VALID_UPDATE_BODY, { id: 'note-1' });
    const res = mockRes();

    await updateNoteController(req, res);

    expect(updateNote).toHaveBeenCalledOnce();
    expect(updateNote).toHaveBeenCalledWith('user-1', 'note-1', { title: 'Updated Title' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedNote);
  });
});

// ---------------------------------------------------------------------------
// CTRL-NOTE-U2: updateNoteController — empty body → AppError 400 VALIDATION_FAILED
// FR-NOTE-3 (updateNoteSchema refine: at least one field required)
// ---------------------------------------------------------------------------

describe('CTRL-NOTE-U2: updateNoteController empty body (FR-NOTE-3)', () => {
  it('CTRL-NOTE-U2: throws AppError 400 VALIDATION_FAILED when body has no fields', async () => {
    const req = mockReq({}, { id: 'note-1' }); // empty body → refine fails
    const res = mockRes();

    await expect(updateNoteController(req, res)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    } satisfies Partial<AppError>);

    expect(updateNote).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CTRL-NOTE-D1: deleteNoteController — valid params.id → 204
// FR-NOTE-4
// ---------------------------------------------------------------------------

describe('CTRL-NOTE-D1: deleteNoteController valid params.id (FR-NOTE-4)', () => {
  it('CTRL-NOTE-D1: calls deleteNote(userId, noteId) and responds 204', async () => {
    (deleteNote as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

    const req = mockReq({}, { id: 'note-1' });
    const res = mockRes();

    await deleteNoteController(req, res);

    expect(deleteNote).toHaveBeenCalledOnce();
    expect(deleteNote).toHaveBeenCalledWith('user-1', 'note-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});
