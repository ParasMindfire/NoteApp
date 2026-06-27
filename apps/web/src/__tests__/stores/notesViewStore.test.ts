import { describe, it, expect, beforeEach } from 'vitest';
import { useNotesViewStore } from '@/stores/notesViewStore';

describe('notesViewStore (FR-UI-NOTES-2)', () => {
  beforeEach(() => {
    useNotesViewStore.setState({ sort: 'createdAt:desc' });
  });

  it('UI-NOTES-SORT-S1: default sort is createdAt:desc', () => {
    const { sort } = useNotesViewStore.getState();
    expect(sort).toBe('createdAt:desc');
  });

  it('UI-NOTES-SORT-S1: setSort updates sort to the given SortOption', () => {
    useNotesViewStore.getState().setSort('updatedAt:asc');
    expect(useNotesViewStore.getState().sort).toBe('updatedAt:asc');
  });

  it('UI-NOTES-SORT-S2: multiple useNotesViewStore calls share the same state (singleton store)', () => {
    // Simulate navigation: first component reads store
    useNotesViewStore.getState().setSort('updatedAt:desc');

    // Second "component" (same store instance) reads the same state
    const sortFromAnotherComponent = useNotesViewStore.getState().sort;
    expect(sortFromAnotherComponent).toBe('updatedAt:desc');
  });

  it('UI-NOTES-SORT-S1: setSort to all valid SortOption values updates state correctly', () => {
    const sortOptions = [
      'createdAt:desc',
      'createdAt:asc',
      'updatedAt:desc',
      'updatedAt:asc',
    ] as const;

    for (const option of sortOptions) {
      useNotesViewStore.getState().setSort(option);
      expect(useNotesViewStore.getState().sort).toBe(option);
    }
  });
});
