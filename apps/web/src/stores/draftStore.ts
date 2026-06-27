import { create } from 'zustand';

export interface Draft {
  title: string;
  body: Record<string, unknown>;
  tagIds: string[];
}

interface DraftState {
  drafts: Record<string, Draft>;
  setDraft: (noteId: string, draft: Draft) => void;
  clearDraft: (noteId: string) => void;
}

export const useDraftStore = create<DraftState>((set) => ({
  drafts: {},
  setDraft: (noteId, draft) =>
    set((state) => ({ drafts: { ...state.drafts, [noteId]: draft } })),
  clearDraft: (noteId) =>
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[noteId];
      return { drafts };
    }),
}));
