import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMinDuration } from '@/hooks/useMinDuration';

interface ShareGenerateFormProps {
  isPending: boolean;
  onGenerate: (expiresAt: string | undefined) => void;
}

export function ShareGenerateForm({ isPending, onGenerate }: ShareGenerateFormProps) {
  const [expiresAt, setExpiresAt] = useState('');
  const showSpinner = useMinDuration(isPending, 200);

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGenerate(expiresAt ? new Date(expiresAt).toISOString() : undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="share-expiry">Expiry date (optional)</Label>
        <Input
          id="share-expiry"
          type="date"
          min={tomorrow}
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          aria-label="Share link expiry date"
        />
      </div>
      <Button type="submit" disabled={showSpinner} className="w-full sm:w-auto">
        {showSpinner ? (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
            Generating…
          </span>
        ) : (
          'Generate link'
        )}
      </Button>
    </form>
  );
}
