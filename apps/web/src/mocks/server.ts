import { setupServer } from 'msw/node';
import { authHandlers } from './handlers/auth.handlers';
import { notesHandlers } from './handlers/notes.handlers';
import { editorHandlers } from './handlers/editor.handlers';

export const server = setupServer(...authHandlers, ...notesHandlers, ...editorHandlers);
