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

interface RevokeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function RevokeConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: RevokeConfirmDialogProps) {
  const showSpinner = useMinDuration(isPending, 200);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="revoke-description">
        <DialogHeader>
          <DialogTitle>Revoke this share link?</DialogTitle>
          <DialogDescription id="revoke-description">
            Anyone with the link will no longer be able to view this note.
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
            aria-label="Confirm revoke"
          >
            {showSpinner ? (
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden="true"
                />
                Revoking…
              </span>
            ) : (
              'Revoke'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
