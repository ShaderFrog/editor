import { useState, useLayoutEffect } from 'react';
import useResizeObserver from '@react-hook/resize-observer';

export const useSize = (target: React.RefObject<HTMLDivElement>) => {
  const [size, setSize] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (target.current) {
      console.log(
        'resize',
        target.current,
        target.current.getBoundingClientRect()
      );
      setSize(target.current.getBoundingClientRect());
    }
  }, [target]);

  // Where the magic happens
  useResizeObserver(target, (entry) => {
    console.log('resize', target, entry.contentRect);
    setSize(entry.contentRect);
  });
  return size;
};
