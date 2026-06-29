import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { NoteVersionSummary } from '@/types/versions';

interface VersionListItemProps {
  version: NoteVersionSummary;
  isSelected: boolean;
  onClick: (id: string) => void;
}

export function VersionListItem({ version, isSelected, onClick }: VersionListItemProps) {
  const relativeTime = formatDistanceToNow(new Date(version.savedAt), { addSuffix: true });

  return (
    <button
      type="button"
      data-testid="version-list-item"
      onClick={() => onClick(version.id)}
      className={cn(
        'w-full rounded-md p-3 text-left transition-colors hover:bg-accent',
        isSelected && 'bg-accent',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Version {version.version}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{relativeTime}</span>
      </div>
      <p className="mt-0.5 truncate text-sm text-foreground">{version.title}</p>
    </button>
  );
}
