import { useEffect, useRef, useState } from 'react';

/**
 * Returns `true` while `isPending` is true OR within `ms` milliseconds after
 * it becomes false. Prevents spinner flicker on fast responses (FR-UI-AUTH-7).
 */
export function useMinDuration(isPending: boolean, ms: number = 200): boolean {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPending) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsVisible(true);
    } else {
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, ms);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPending, ms]);

  return isVisible;
}
