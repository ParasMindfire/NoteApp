import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagChip } from './TagChip';
import type { Tag } from '@/types/notes';

interface TagFilterChipsProps {
  activeTagIds: string[];
  onToggle: (id: string) => void;
}

function TagEditPopover({
  tag,
  onDeleted,
}: {
  tag: Tag;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; color?: string }) =>
      api.patch<Tag>(`/tags/${tag.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Tag updated');
      setOpen(false);
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'TAG_NAME_DUPLICATE') {
        toast.error('A tag with that name already exists');
      } else {
        toast.error('Failed to update tag');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tags/${tag.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Tag deleted');
      onDeleted(tag.id);
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to delete tag');
    },
  });

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  function handleSave() {
    const updates: { name?: string; color?: string } = {};
    if (name !== tag.name) updates.name = name;
    if (color !== tag.color) updates.color = color;
    if (Object.keys(updates).length === 0) {
      setOpen(false);
      return;
    }
    updateMutation.mutate(updates);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Edit tag ${tag.name}`}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-3 p-3" align="start">
        <div className="space-y-1.5">
          <label htmlFor={`tag-name-${tag.id}`} className="text-xs font-medium">
            Name
          </label>
          <Input
            id={`tag-name-${tag.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-sm"
            maxLength={50}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`tag-color-${tag.id}`} className="text-xs font-medium">
            Color
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`tag-color-${tag.id}`}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border-none"
              disabled={isPending}
            />
            <span className="text-xs text-muted-foreground">{color}</span>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={() => deleteMutation.mutate()}
            disabled={isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-3 w-3" />
            )}
            Delete
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={isPending || name.trim().length === 0}
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TagFilterChips({ activeTagIds, onToggle }: TagFilterChipsProps) {
  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get<Tag[]>('/tags').then((r) => r.data),
    staleTime: 60_000,
  });

  function handleTagDeleted(id: string) {
    if (activeTagIds.includes(id)) {
      onToggle(id);
    }
  }

  if (!tags || tags.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      aria-label="Filter by tag"
      role="group"
    >
      {tags.map((tag) => (
        <div key={tag.id} className="group flex items-center gap-0.5">
          <TagChip
            id={tag.id}
            name={tag.name}
            color={tag.color}
            active={activeTagIds.includes(tag.id)}
            onToggle={onToggle}
          />
          <TagEditPopover tag={tag} onDeleted={handleTagDeleted} />
        </div>
      ))}
    </div>
  );
}
