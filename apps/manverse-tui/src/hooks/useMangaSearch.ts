import { useState, useCallback } from 'react';
import { SearchService, type UnifiedSearchResults } from '../services/search-service.js';

export const useMangaSearch = () => {
  const [results, setResults] = useState<UnifiedSearchResults>({
    anilist: [],
    provider: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults({ anilist: [], provider: [] });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const service = SearchService.getInstance();
      const data = await service.search(query);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults({ anilist: [], provider: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults({ anilist: [], provider: [] });
    setLoading(false);
    setError(null);
  }, []);

  return { results, loading, error, search, clear };
};
