"use client";

// Whether an element overflows its own box, so it needs a scroll region of its
// own. The result is false on the server and on the first client render, so the
// markup never depends on a measurement the server does not have. After mount
// the element is observed with a ResizeObserver. Without ResizeObserver the
// hook reports false and the element is left as it is. No viewport width is
// read.

import { useEffect, useState, type RefObject } from "react";

export function useOwnScroll(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || element === null || typeof ResizeObserver === "undefined") {
      setOverflowing(false);
      return;
    }
    const measure = () => {
      setOverflowing(element.scrollHeight > element.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);

  return overflowing;
}
