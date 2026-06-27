import { cn } from '@/lib/utils';

interface TagChipProps {
  id: string;
  name: string;
  color: string;
  active?: boolean;
  onToggle?: (id: string) => void;
  readonly?: boolean;
  className?: string;
}

export function TagChip({ id, name, color, active = false, onToggle, readonly = false, className }: TagChipProps) {
  const isInteractive = !readonly && onToggle;

  const style = active
    ? { backgroundColor: color, borderColor: color, color: '#fff' }
    : { borderColor: color, color };

  if (isInteractive) {
    return (
      <button
        type="button"
        onClick={() => onToggle!(id)}
        aria-pressed={active}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          className,
        )}
        style={style}
      >
        {name}
      </button>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
      style={style}
    >
      {name}
    </span>
  );
}
