import { useRef, useEffect } from 'react';

export const usePrevious = <T extends unknown>(value: T): T | undefined => {
  const ref = useRef<T>(undefined as T);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};
