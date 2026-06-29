export interface ShareLink {
  id: string;
  token: string;
  shareUrl: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
}
