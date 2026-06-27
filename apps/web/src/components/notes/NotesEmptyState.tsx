import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface NotesEmptyStateProps {
  variant: 'empty' | 'no-match';
}

export function NotesEmptyState({ variant }: NotesEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FileText className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
      {variant === 'empty' ? (
        <>
          <h2 className="mb-2 text-xl font-semibold text-foreground">No notes yet</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Start capturing your thoughts and ideas.
          </p>
          <Button asChild>
            <Link to="/notes/new">Create your first note</Link>
          </Button>
        </>
      ) : (
        <>
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            No notes match these filters
          </h2>
          <p className="text-sm text-muted-foreground">Try adjusting or clearing your filters.</p>
        </>
      )}
    </div>
  );
}
