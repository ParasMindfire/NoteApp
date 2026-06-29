import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ShareLink } from '@/types/shares';

interface ShareLinkCardProps {
  link: ShareLink;
  onRevoke: (token: string) => void;
}

export function ShareLinkCard({ link, onRevoke }: ShareLinkCardProps) {
  const isRevoked = link.revokedAt !== null;
  const tokenTail = link.token.slice(-6);

  return (
    <div
      className={`flex items-center justify-between rounded-md border border-border p-3 ${isRevoked ? 'opacity-50' : ''}`}
      data-testid="share-link-card"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-foreground">…{tokenTail}</span>
          {isRevoked && (
            <Badge variant="secondary" className="text-xs">
              Revoked
            </Badge>
          )}
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{link.viewCount} view{link.viewCount !== 1 ? 's' : ''}</span>
          {link.expiresAt ? (
            <span>Expires {formatDistanceToNow(new Date(link.expiresAt), { addSuffix: true })}</span>
          ) : (
            <span>No expiry</span>
          )}
          <span>Created {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}</span>
        </div>
      </div>

      {!isRevoked && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onRevoke(link.token)}
          aria-label={`Revoke share link ending in ${tokenTail}`}
        >
          Revoke
        </Button>
      )}
    </div>
  );
}
