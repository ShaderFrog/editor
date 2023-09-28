import { useRef, useEffect } from 'react';

const useTimeout = (callback: () => void, delay: number) => {
  const timeoutRef = useRef<number>();
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    const tick = () => savedCallback.current();
    if (typeof delay === 'number') {
      timeoutRef.current = window.setTimeout(tick, delay);
      return () => window.clearTimeout(timeoutRef.current);
    }
  }, [delay]);
  return timeoutRef;
};

export default useTimeout;
