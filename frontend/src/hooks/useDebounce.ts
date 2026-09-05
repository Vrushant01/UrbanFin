import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any value (e.g. search input terms)
 * @param value The value to debounce
 * @param delay Delay in milliseconds (default 250ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
