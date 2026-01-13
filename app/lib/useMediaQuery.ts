import { useEffect, useState } from 'react';

const getInitialMatch = (query: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  return window.matchMedia(query).matches;
};

export const useMediaQuery = (query: string, fallback = false) => {
  const [matches, setMatches] = useState(() => getInitialMatch(query, fallback));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();

    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);

  return matches;
};
