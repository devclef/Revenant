// Feature: 09-demo-polish, A14 (branded not-found and error pages)
//
// Render tests for the error boundary. The page must show the branded copy and
// a retry button that calls reset(). It must never render the error message or
// the digest.

import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { UI_COPY } from "@/components/ui/copy";

vi.mock("@/components/ceremony/motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: () => {} }),
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ceremony/skip", () => ({
  useSequence: () => ({ hasActive: false, register: () => () => {}, skipAll: () => {} }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

// Imported after the mocks (vi.mock is hoisted).
import ErrorPage from "./error";

const SECRET_MESSAGE = "db password is hunter2";
const DIGEST = "digest-7f3a9c";

function failure(): Error & { digest?: string } {
  const error = new Error(SECRET_MESSAGE) as Error & { digest?: string };
  error.digest = DIGEST;
  return error;
}

describe("error page", () => {
  it("shows the branded heading and body", () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: failure(), reset: () => {} }));

    expect(html).toContain(UI_COPY.error.heading);
    expect(html).toContain(UI_COPY.error.body);
  });

  it("renders the retry button label", () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: failure(), reset: () => {} }));

    expect(html).toContain(`<button type="button"`);
    expect(html).toContain(UI_COPY.error.retry);
  });

  it("never renders the error message or the digest", () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: failure(), reset: () => {} }));

    expect(html).not.toContain(SECRET_MESSAGE);
    expect(html).not.toContain(DIGEST);
  });

  it("wires the retry button to reset()", () => {
    const reset = vi.fn();
    const tree = ErrorPage({ error: failure(), reset }) as ReactElement<{ action?: unknown }>;
    const action = tree.props.action;

    expect(isValidElement(action)).toBe(true);
    const button = action as ReactElement<{ onClick: () => void }>;
    expect(button.type).toBe("button");

    button.props.onClick();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
