export interface Tag {
  id: string;
  name: string;
  color: string;
  noteCount?: number;
}

export interface Note {
  id: string;
  title: string;
  body: Record<string, unknown>;
  tagIds: string[];
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface PaginatedNotes {
  items: Note[];
  nextCursor: string | null;
}

export interface SearchResult {
  note: Note;
  headline: string;
}

export interface PaginatedSearchResults {
  items: SearchResult[];
  nextCursor: string | null;
}
