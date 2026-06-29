export interface NoteVersionSummary {
  id: string;
  version: number;
  title: string;
  savedAt: string;
}

export interface NoteVersion extends NoteVersionSummary {
  body: Record<string, unknown>;
}
