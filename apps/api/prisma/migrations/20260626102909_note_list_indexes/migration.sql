-- CreateIndex
CREATE INDEX "Note_userId_createdAt_id_idx" ON "Note"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Note_userId_updatedAt_id_idx" ON "Note"("userId", "updatedAt", "id");
