"use client";

// Feature: 09-demo-polish, A14 (branded not-found and error pages)
//
// Next.js renders this boundary when a page below the root layout throws. It
// shows the branded body with a retry button. It never renders the error
// message or the digest: those can carry internal detail, and the reader needs
// only the copy in copy.ts.

import { BrandedPage } from "@/components/ui/BrandedPage";
import { UI_COPY } from "@/components/ui/copy";

export type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <BrandedPage
      heading={UI_COPY.error.heading}
      body={UI_COPY.error.body}
      action={
        <button type="button" onClick={() => reset()}>
          {UI_COPY.error.retry}
        </button>
      }
    />
  );
}
