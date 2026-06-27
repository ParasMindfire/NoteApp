import DOMPurify from 'dompurify';
import { Link } from 'react-router-dom';
import type { SearchResult } from '@/types/notes';

interface SearchResultCardProps {
  result: SearchResult;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const safeHeadline = DOMPurify.sanitize(result.headline, { ALLOWED_TAGS: ['mark'] });

  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
      <Link
        to={`/notes/${result.note.id}`}
        className="block font-medium text-foreground hover:underline mb-1"
      >
        {result.note.title}
      </Link>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {/* safeHeadline has been sanitized — only <mark> tags allowed */}
        <span dangerouslySetInnerHTML={{ __html: safeHeadline }} />
      </p>
    </div>
  );
}
