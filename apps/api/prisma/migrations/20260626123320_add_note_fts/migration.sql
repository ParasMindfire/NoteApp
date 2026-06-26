-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "bodyText" TEXT NOT NULL DEFAULT '';

-- GIN index for full-text search (manually added — Prisma cannot generate this)
CREATE INDEX "note_fts_idx" ON "Note" USING GIN (
  to_tsvector('english', title || ' ' || "bodyText")
);
