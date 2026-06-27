import { create } from 'zustand';

type SortOption = 'createdAt:desc' | 'createdAt:asc' | 'updatedAt:desc' | 'updatedAt:asc';

interface NotesViewState {
  sort: SortOption;
  setSort: (sort: SortOption) => void;
}

export const useNotesViewStore = create<NotesViewState>()((set) => ({
  sort: 'createdAt:desc',
  setSort: (sort) => set({ sort }),
}));
