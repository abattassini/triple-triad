import { useEffect, useRef, useState } from 'react';
import { apiService, type PlayerSearchResult } from '../services/api';

/**
 * The shortest query the server will answer. Kept in step with `PlayerController.MinimumSearchLength`; below it the
 * page clears rather than asking, so the empty box never looks like a slow search.
 */
export const MIN_SEARCH_LENGTH = 1;

/**
 * The Social page's live player lookup (`plans/PLAN-026-player-search-and-online-page/plan.md` §3.3, §12): given the
 * text in the box, it asks for the matching players **on every keystroke** — there is no debounce, so a single
 * character is enough to see results, and typing a second character never swallows the first request. Same shape as
 * `usePackInventory`/`useFriends`: the hook owns the data (results, `isLoading`, `error`) and the page draws it.
 *
 * Two disciplines, both borrowed from the profile modal:
 *  - a **request id** so a slow reply for an earlier keystroke can never paint over a later one — which is exactly what
 *    makes per-keystroke requests safe: only the answer to the last character typed is allowed to render;
 *  - a **clear below the minimum** that invalidates any in-flight reply, so deleting back to nothing cannot leave stale
 *    results on screen while the request that produced them is still out.
 */
export const usePlayerSearch = (query: string) => {
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every query change; only the newest request may paint.
  const newestRequest = useRef(0);

  useEffect(() => {
    const term = query.trim();

    if (term.length < MIN_SEARCH_LENGTH) {
      newestRequest.current += 1; // an in-flight reply for the old term is now stale
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const request = ++newestRequest.current;
    setIsLoading(true);

    apiService
      .searchPlayers(term)
      .then(answer => {
        if (request === newestRequest.current) {
          setResults(answer.players);
          setError(null);
        }
      })
      .catch((failure: Error) => {
        if (request === newestRequest.current) {
          setError(failure.message);
        }
      })
      .finally(() => {
        if (request === newestRequest.current) {
          setIsLoading(false);
        }
      });
  }, [query]);

  return { results, isLoading, error };
};
