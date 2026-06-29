import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMinDuration } from '@/hooks/useMinDuration';

interface RestoreConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function RestoreConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: RestoreConfirmDialogProps) {
  const showSpinner = useMinDuration(isPending, 200);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="restore-description">
        <DialogHeader>
          <DialogTitle>Restore this version?</DialogTitle>
          <DialogDescription id="restore-description">
            This will create a new version — your current work won&apos;t be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={showSpinner}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={showSpinner}
            aria-label="Confirm restore"
          >
            {showSpinner ? (
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Restoring…
              </span>
            ) : (
              'Restore'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
