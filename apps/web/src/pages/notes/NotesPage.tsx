import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotesViewStore } from '@/stores/notesViewStore';
import { NotesSortDropdown } from '@/components/notes/NotesSortDropdown';
import { TagFilterChips } from '@/components/notes/TagFilterChips';
import { NotesList } from '@/components/notes/NotesList';

export function NotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = useNotesViewStore((s) => s.sort);

  const activeTagIds = searchParams.get('tags')
    ? searchParams.get('tags')!.split(',').filter(Boolean)
    : [];

  function handleTagToggle(id: string) {
    const next = activeTagIds.includes(id)
      ? activeTagIds.filter((t) => t !== id)
      : [...activeTagIds, id];
    setSearchParams(next.length ? { tags: next.join(',') } : {}, { replace: true });
  }

  function handleClearTagFilter() {
    setSearchParams({}, { replace: true });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Notes</h1>
        <Button asChild size="sm">
          <Link to="/notes/new">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New Note
          </Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <NotesSortDropdown />
        <TagFilterChips activeTagIds={activeTagIds} onToggle={handleTagToggle} />
      </div>

      <NotesList sort={sort} tagIds={activeTagIds} onClearTagFilter={handleClearTagFilter} />
    </div>
  );
}
