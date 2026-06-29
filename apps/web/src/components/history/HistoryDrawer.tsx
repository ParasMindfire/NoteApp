import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { History } from 'lucide-react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errorMessages';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { VersionListItem } from './VersionListItem';
import { VersionPreviewPane } from './VersionPreviewPane';
import { RestoreConfirmDialog } from './RestoreConfirmDialog';
import type { NoteVersion, NoteVersionSummary } from '@/types/versions';
import type { Note } from '@/types/notes';

interface HistoryDrawerProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  currentBody: Record<string, unknown>;
  onRestore: (note: Note) => void;
}

export function HistoryDrawer({
  noteId,
  open,
  onOpenChange,
  currentTitle,
  currentBody,
  onRestore,
}: HistoryDrawerProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: versions, isLoading: versionsLoading } = useQuery<NoteVersionSummary[]>({
    queryKey: ['versions', noteId],
    queryFn: async () => {
      const { data } = await api.get<NoteVersionSummary[]>(`/notes/${noteId}/versions`);
      return data;
    },
    enabled: open,
  });

  const { data: selectedVersion, isLoading: versionDetailLoading } = useQuery<NoteVersion>({
    queryKey: ['version', noteId, selectedVersionId],
    queryFn: async () => {
      const { data } = await api.get<NoteVersion>(
        `/notes/${noteId}/versions/${selectedVersionId}`,
      );
      return data;
    },
    enabled: !!selectedVersionId,
  });

  const restoreMutation = useMutation<Note, Error>({
    mutationFn: async () => {
      const { data } = await api.post<Note>(
        `/notes/${noteId}/versions/${selectedVersionId}/restore`,
      );
      return data;
    },
    onSuccess: (note) => {
      const versionNum =
        versions?.find((v) => v.id === selectedVersionId)?.version ?? selectedVersionId;
      onRestore(note);
      onOpenChange(false);
      setSelectedVersionId(null);
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['versions', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success(`Restored version ${versionNum}`);
    },
    onError: (err) => {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code;
      toast.error(getErrorMessage(code));
    },
  });

  function handleVersionClick(id: string) {
    setSelectedVersionId(id);
  }

  function handleRestoreClick() {
    setConfirmOpen(true);
  }

  function handleConfirmRestore() {
    restoreMutation.mutate();
  }

  const isPreview = !!selectedVersionId;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          aria-label="Version history"
          className={cn(
            'flex flex-col overflow-hidden',
            isPreview ? 'w-full max-w-3xl' : 'max-w-sm',
          )}
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>Version history</SheetTitle>
          </SheetHeader>

          {isPreview && selectedVersion ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <VersionPreviewPane
                version={selectedVersion}
                currentTitle={currentTitle}
                currentBody={currentBody}
                onRestore={handleRestoreClick}
                isRestoring={restoreMutation.isPending}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {versionsLoading ? (
                <div className="flex flex-col gap-2 pt-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !versions || versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <History className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No versions yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1 pt-2">
                  {versions.map((v) => (
                    <VersionListItem
                      key={v.id}
                      version={v}
                      isSelected={v.id === selectedVersionId}
                      onClick={handleVersionClick}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {isPreview && versionDetailLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {selectedVersion && (
        <RestoreConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onConfirm={handleConfirmRestore}
          isPending={restoreMutation.isPending}
        />
      )}
    </>
  );
}
