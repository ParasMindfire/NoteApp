import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotesViewStore } from '@/stores/notesViewStore';

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest' },
  { value: 'createdAt:asc', label: 'Oldest' },
  { value: 'updatedAt:desc', label: 'Recently Updated' },
  { value: 'updatedAt:asc', label: 'Least Recently Updated' },
] as const;

export function NotesSortDropdown() {
  const sort = useNotesViewStore((s) => s.sort);
  const setSort = useNotesViewStore((s) => s.setSort);

  return (
    <Select value={sort} onValueChange={setSort}>
      <SelectTrigger className="w-48" aria-label="Sort notes">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
