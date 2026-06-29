import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { getTagColor } from '@/lib/tagColors';
import { toast } from 'sonner';
import type { Tag } from '@/types/notes';

interface TagComboboxProps {
  tagIds: string[];
  onChange: (tagIds: string[]) => void;
}

export function TagCombobox({ tagIds, onChange }: TagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const queryClient = useQueryClient();

  const { data: allTags = [] } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<Tag[]>('/tags');
      return data;
    },
  });

  const selectedTags = allTags.filter((t) => tagIds.includes(t.id));
  const availableTags = allTags.filter((t) => !tagIds.includes(t.id));
  const filteredTags = availableTags.filter((t) =>
    t.name.toLowerCase().includes(inputValue.toLowerCase()),
  );
  const hasExactMatch = filteredTags.some(
    (t) => t.name.toLowerCase() === inputValue.toLowerCase(),
  );

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const color = getTagColor(allTags.length);
      const { data } = await api.post<Tag>('/tags', { name, color });
      return data;
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      onChange([...tagIds, newTag.id]);
      setInputValue('');
      setOpen(false);
    },
    onError: (error: unknown) => {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'TAG_NAME_DUPLICATE') {
        const existing = allTags.find(
          (t) => t.name.toLowerCase() === inputValue.toLowerCase(),
        );
        if (existing && !tagIds.includes(existing.id)) {
          onChange([...tagIds, existing.id]);
        }
        setInputValue('');
        setOpen(false);
      } else {
        toast.error('Invalid tag name.');
      }
    },
  });

  function handleSelect(tag: Tag) {
    onChange([...tagIds, tag.id]);
    setInputValue('');
    setOpen(false);
  }

  function handleRemove(tagId: string) {
    onChange(tagIds.filter((id) => id !== tagId));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const exactMatch = filteredTags.find(
        (t) => t.name.toLowerCase() === inputValue.toLowerCase(),
      );
      if (exactMatch) {
        handleSelect(exactMatch);
      } else {
        createTagMutation.mutate(inputValue.trim());
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="tag-combobox">
      {selectedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="gap-1 pr-1 font-normal"
          style={{
            backgroundColor: `${tag.color}22`,
            color: tag.color,
            borderColor: `${tag.color}44`,
          }}
        >
          {tag.name}
          <button
            type="button"
            onClick={() => handleRemove(tag.id)}
            aria-label={`Remove tag ${tag.name}`}
            className="ml-0.5 rounded-full hover:bg-black/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Add tag"
          >
            <Plus className="h-3 w-3" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create tag…"
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={handleKeyDown}
            />
            <CommandList>
              {filteredTags.length === 0 && !inputValue && (
                <CommandEmpty>No tags yet. Type to create one.</CommandEmpty>
              )}
              {filteredTags.length === 0 && inputValue && (
                <CommandEmpty>
                  Press <kbd className="rounded border px-1 text-xs">Enter</kbd> to create &ldquo;
                  {inputValue}&rdquo;
                </CommandEmpty>
              )}
              {filteredTags.length > 0 && (
                <CommandGroup>
                  {filteredTags.map((tag) => (
                    <CommandItem key={tag.id} value={tag.name} onSelect={() => handleSelect(tag)}>
                      <span
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {inputValue && !hasExactMatch && (
                <CommandGroup>
                  <CommandItem
                    value={`__create__${inputValue}`}
                    onSelect={() => createTagMutation.mutate(inputValue.trim())}
                    disabled={createTagMutation.isPending}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Create &ldquo;{inputValue}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
