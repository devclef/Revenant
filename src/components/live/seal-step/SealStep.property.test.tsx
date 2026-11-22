// Feature: 16-remember-first, Property 12: Press the seal shows each sentence once
//
// Property test for the Seal step's visible text (spec 16, design Property 12;
// requirements 14.1, 14.2, 14.6, 14.7). fast-check runs each property at least
// 100 times.
//
// The motion setting is not varied here. A static render reads the "full"
// setting, and the press status line for every motion setting is covered by
// press-status.property.test.ts.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import type { BackupChoiceValue } from "../write-draft";
import { SealStep, type SealStepProps } from "./SealStep";
import type { PressStatusTag } from "./press-status";

const TAGS: readonly PressStatusTag[] = [
  "write",
  "creating",
  "created",
  "confirming",
  "preparing",
  "sealing",
];
const CHOICES: readonly (BackupChoiceValue | null)[] = [null, "card", "skip"];

const tagArb = fc.constantFrom(...TAGS);
const choiceArb = fc.constantFrom(...CHOICES);
const modeArb = fc.constantFrom("write" as const, "setting" as const);

/** The text a reader sees: tags removed, the escapes React writes decoded. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/** Sentences split at full stops, question marks and exclamation marks. */
function sentencesOf(text: string): string[] {
  return text
    .split(/[.!?]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

describe("Seal step text (spec 16, Property 12)", () => {
  it("shows the warning once, Revenant demo once, and no sentence twice", () => {
    fc.assert(
      fc.property(
        tagArb,
        choiceArb,
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        modeArb,
        fc.integer({ min: 0, max: 3 }),
        (
          tag,
          backupChoice,
          prfMissing,
          pressBlocked,
          ready,
          mode,
          questionCount,
        ) => {
          const props: SealStepProps = {
            tag,
            backupChoice,
            onBackupChoice: () => undefined,
            pressBlocked,
            ready,
            mode,
            questionCount,
            prfMissing,
            onBackupStart: prfMissing ? () => undefined : undefined,
            onCreatePress: () => undefined,
            onConfirmPress: () => undefined,
            onAttempt: () => undefined,
          };
          const html = renderToStaticMarkup(createElement(SealStep, props));
          const text = visibleText(html);

          expect(countOf(text, LIVE_COPY.warning)).toBe(1);
          expect(countOf(text, "Revenant demo")).toBe(1);

          const sentences = sentencesOf(text);
          expect(new Set(sentences).size).toBe(sentences.length);
        },
      ),
    );
  });
});
