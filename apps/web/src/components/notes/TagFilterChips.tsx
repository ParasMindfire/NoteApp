import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TagChip } from './TagChip';
import type { Tag } from '@/types/notes';

interface TagFilterChipsProps {
  activeTagIds: string[];
  onToggle: (id: string) => void;
}

export function TagFilterChips({ activeTagIds, onToggle }: TagFilterChipsProps) {
  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get<Tag[]>('/tags').then((r) => r.data),
    staleTime: 60_000,
  });

  if (!tags || tags.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      aria-label="Filter by tag"
      role="group"
    >
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          id={tag.id}
          name={tag.name}
          color={tag.color}
          active={activeTagIds.includes(tag.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
