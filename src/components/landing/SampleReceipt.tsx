// Feature: 09-demo-polish (B3.4, B3.7)
//
// The Sample_Receipt on `/`. The server HTML is the heading and a reserved box
// (the view with state `loading`). After hydration it makes one
// GET /api/figures and shows the first series. This is the only client code on
// the landing page beyond spec 08.

"use client";

import { useEffect, useRef, useState } from "react";

import { SampleReceiptView } from "./SampleReceiptView";
import { loadSampleFigure, type SampleState } from "./sample-receipt";

export function SampleReceipt() {
  const [state, setState] = useState<SampleState>({ status: "loading" });
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void loadSampleFigure().then(setState);
  }, []);

  return <SampleReceiptView state={state} />;
}
