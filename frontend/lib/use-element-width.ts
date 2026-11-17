"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Width of an element in CSS px, kept current with a ResizeObserver. `undefined` until the first
 * measurement. Attach the returned `ref` to the element; a callback ref follows the element if it
 * is mounted later or replaced.
 */
export function useElementWidth<T extends HTMLElement>(): [(node: T | null) => void, number | undefined] {
  const [width, setWidth] = useState<number | undefined>(undefined);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    const next = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setWidth(entry.contentRect.width);
    });
    next.observe(node);
    observer.current = next;
  }, []);

  return [ref, width];
}
