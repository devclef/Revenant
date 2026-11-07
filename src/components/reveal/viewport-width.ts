"use client";

// Feature: 09-demo-polish (spec 09 C5.1)
//
// The viewport width in CSS px, read after mount. Shared by OpeningFlow (which
// decides whether the Ghost holds the Envelope at reveal stage 1) and Reveal
// (which decides where the stage 1 seal is drawn). Null on the server and the
// first client render, so the markup never depends on a width the server does
// not have, and hydration never mismatches.

import { useEffect, useState } from "react";

export function useViewportWidth(): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}
