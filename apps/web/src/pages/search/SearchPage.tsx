import { useSearchParams } from 'react-router-dom';
import { SearchInput } from '@/components/search/SearchInput';
import { SearchResultsList } from '@/components/search/SearchResultsList';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  function handleQueryChange(value: string) {
    if (value) {
      setSearchParams({ q: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Search</h1>
      <SearchInput value={query} onChange={handleQueryChange} />
      <SearchResultsList query={query} />
    </div>
  );
}
