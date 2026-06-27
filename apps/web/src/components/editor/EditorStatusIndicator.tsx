import { useEditorStatusStore } from '@/stores/editorStatusStore';
import { cn } from '@/lib/utils';

interface EditorStatusIndicatorProps {
  onRetry: () => void;
}

export function EditorStatusIndicator({ onRetry }: EditorStatusIndicatorProps) {
  const status = useEditorStatusStore((s) => s.status);

  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        Saving…
      </span>
    );
  }

  if (status === 'saved') {
    return (
      <span className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        Saved
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onRetry}
      aria-label="Save failed — retry"
      className={cn(
        'text-xs text-destructive underline-offset-2 hover:underline',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
      )}
    >
      Save failed — retry
    </button>
  );
}
