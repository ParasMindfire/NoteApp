import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ShareLinkCard } from './ShareLinkCard';
import { ShareGenerateForm } from './ShareGenerateForm';
import { RevokeConfirmDialog } from './RevokeConfirmDialog';
import type { ShareLink } from '@/types/shares';

interface ShareModalProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareModal({ noteId, open, onOpenChange }: ShareModalProps) {
  const queryClient = useQueryClient();
  const [tokenToRevoke, setTokenToRevoke] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const { data: links, isLoading } = useQuery<ShareLink[]>({
    queryKey: ['shares', noteId],
    queryFn: async () => {
      const { data } = await api.get<ShareLink[]>(`/notes/${noteId}/shares`);
      return data;
    },
    enabled: open,
  });

  const revokeMutation = useMutation({
    mutationFn: async (token: string) => {
      await api.delete(`/notes/${noteId}/shares/${token}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shares', noteId] });
      setTokenToRevoke(null);
    },
    onError: () => {
      toast.error('Failed to revoke link. Please try again.');
      setTokenToRevoke(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (expiresAt: string | undefined) => {
      const { data } = await api.post<ShareLink>(`/notes/${noteId}/shares`, expiresAt ? { expiresAt } : {});
      return data;
    },
    onSuccess: async (shareLink) => {
      void queryClient.invalidateQueries({ queryKey: ['shares', noteId] });
      try {
        await navigator.clipboard.writeText(shareLink.shareUrl);
        toast.success('Link copied to clipboard');
      } catch {
        toast.error("Couldn't copy link — copy it manually:");
        setFallbackUrl(shareLink.shareUrl);
      }
    },
    onError: () => {
      toast.error('Failed to generate share link. Please try again.');
    },
  });

  function handleRevoke(token: string) {
    setTokenToRevoke(token);
  }

  function handleRevokeConfirm() {
    if (tokenToRevoke) {
      revokeMutation.mutate(tokenToRevoke);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" aria-describedby="share-modal-description">
          <DialogHeader>
            <DialogTitle>Share note</DialogTitle>
            <DialogDescription id="share-modal-description">
              Generate a public read-only link to share this note.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="flex flex-col gap-2" aria-label="Loading share links">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : !links || links.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active share links. Generate one below.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {links.map((link) => (
                  <ShareLinkCard key={link.id} link={link} onRevoke={handleRevoke} />
                ))}
              </div>
            )}

            {fallbackUrl && (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-muted-foreground">
                  Couldn't copy link — copy it manually:
                </p>
                <Input
                  readOnly
                  value={fallbackUrl}
                  aria-label="Share link URL"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
            )}

            <ShareGenerateForm
              isPending={createMutation.isPending}
              onGenerate={(expiresAt) => createMutation.mutate(expiresAt)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <RevokeConfirmDialog
        open={tokenToRevoke !== null}
        onOpenChange={(open) => { if (!open) setTokenToRevoke(null); }}
        onConfirm={handleRevokeConfirm}
        isPending={revokeMutation.isPending}
      />
    </>
  );
}
