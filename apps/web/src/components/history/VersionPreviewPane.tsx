import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button } from '@/components/ui/button';
import { useMinDuration } from '@/hooks/useMinDuration';
import type { NoteVersion } from '@/types/versions';

interface VersionPreviewPaneProps {
  version: NoteVersion;
  currentTitle: string;
  currentBody: Record<string, unknown>;
  onRestore: () => void;
  isRestoring: boolean;
}

function ReadOnlyEditor({ content }: { content: Record<string, unknown> }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: false,
  });

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm max-w-none focus:outline-none"
    />
  );
}

export function VersionPreviewPane({
  version,
  currentTitle,
  currentBody,
  onRestore,
  isRestoring,
}: VersionPreviewPaneProps) {
  const showSpinner = useMinDuration(isRestoring, 200);

  return (
    <div data-testid="version-preview-pane" className="flex h-full min-h-0 gap-4">
      {/* Left: current note */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Current
          </span>
          <h2 className="mt-1 text-base font-semibold text-foreground">{currentTitle}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ReadOnlyEditor content={currentBody} />
        </div>
      </div>

      {/* Right: selected version */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Version {version.version}
          </span>
          <h2 className="mt-1 text-base font-semibold text-foreground">{version.title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ReadOnlyEditor content={version.body} />
        </div>
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onRestore}
            disabled={showSpinner}
            aria-label="Restore this version"
            className="w-full"
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
              'Restore this version'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
