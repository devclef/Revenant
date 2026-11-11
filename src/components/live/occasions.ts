/**
 * Occasions for the Write step (spec 11-any-letter, L2): a letter starter and
 * up to three Author_Questions per row, so an author is not facing a blank
 * page. The Occasion_Table is Our_Copy until the visitor edits it.
 *
 * An Occasion is memory only. It is never sent, never stored, never put in the
 * sealed payload and never written to cookies, storage or the URL (L2.5).
 *
 * Pure module: no React, safe in the browser and in tests.
 */

export type OccasionId = "year" | "work" | "family" | "decision" | "blank";

export interface Occasion {
  id: OccasionId;
  label: string;
  starter: string;
  /** The default question first, then up to two subject questions. */
  questions: readonly string[];
}

/** The question every row starts with (L1.2). Names the sealing day. */
export const DEFAULT_QUESTION =
  "Before you read it, what do you remember about the day you sealed this?";

/** The most Author_Questions a letter may hold (L1.1, L2.8). */
export const OCCASION_QUESTIONS_MAX = 3;

const PREDICTION_QUESTION =
  "When you wrote this, what did you think would have happened by the day you opened it?";

/** The Occasion_Table (L2.8). */
export const OCCASIONS: readonly Occasion[] = [
  {
    id: "year",
    label: "The year ahead",
    starter: "This is where my year stands as I write this.",
    questions: [
      DEFAULT_QUESTION,
      "What did you hope the year would hold when you wrote this?",
      PREDICTION_QUESTION,
    ],
  },
  {
    id: "work",
    label: "Work",
    starter:
      "This is what my work looks like as I write this, and what I am still working out.",
    questions: [
      DEFAULT_QUESTION,
      "What was on your mind about work when you wrote this?",
      PREDICTION_QUESTION,
    ],
  },
  {
    id: "family",
    label: "Family",
    starter:
      "This is how things are with the people closest to me as I write this.",
    questions: [
      DEFAULT_QUESTION,
      "Who were you thinking about most when you wrote this?",
      PREDICTION_QUESTION,
    ],
  },
  {
    id: "decision",
    label: "A decision",
    starter:
      "This is the decision in front of me, and where I lean as I write this.",
    questions: [
      DEFAULT_QUESTION,
      "What were you weighing when you wrote this?",
      PREDICTION_QUESTION,
    ],
  },
  {
    id: "blank",
    label: "Blank",
    starter: "",
    questions: [DEFAULT_QUESTION],
  },
];

/**
 * The Write step's Occasion state. `appliedStarter` and `appliedQuestions` hold
 * the text the last Occasion put in, so an unedited row can be told apart from
 * one the visitor typed. Lives only in memory.
 */
export interface OccasionDraft {
  text: string;
  questions: string[];
  occasion: OccasionId;
  appliedStarter: string;
  appliedQuestions: readonly string[];
}

function findOccasion(id: OccasionId): Occasion {
  const found = OCCASIONS.find((o) => o.id === id);
  if (!found) {
    throw new Error(`Unknown occasion: ${id}`);
  }
  return found;
}

/**
 * Applies an Occasion to a draft (L2.2). Typed text is never overwritten:
 *
 * 1. The letter takes the new starter only if it is empty after trim or still
 *    equals the previously applied starter.
 * 2. Each question row index 0 to 2 takes the Occasion's question at that index
 *    only if the row is empty, missing, or still equals the previously applied
 *    Occasion question there. Otherwise the typed row is kept. An unedited row
 *    with no matching Occasion question is dropped.
 * 3. Rows are compacted in order, at most three. If none are left, the default
 *    question is used, so a draft always has at least one question.
 * 4. The applied starter and questions become the new Occasion's values.
 */
export function applyOccasion(
  draft: OccasionDraft,
  id: OccasionId,
): OccasionDraft {
  const occasion = findOccasion(id);

  const text =
    draft.text.trim() === "" || draft.text === draft.appliedStarter
      ? occasion.starter
      : draft.text;

  const rows: string[] = [];
  for (let i = 0; i < OCCASION_QUESTIONS_MAX; i += 1) {
    const current = draft.questions[i];
    const previous = draft.appliedQuestions[i];
    const unedited =
      current === undefined || current.trim() === "" || current === previous;
    if (unedited) {
      const replacement = occasion.questions[i];
      if (replacement !== undefined) {
        rows.push(replacement);
      }
    } else {
      rows.push(current);
    }
  }

  const questions =
    rows.length > 0
      ? rows.slice(0, OCCASION_QUESTIONS_MAX)
      : [DEFAULT_QUESTION];

  return {
    text,
    questions,
    occasion: occasion.id,
    appliedStarter: occasion.starter,
    appliedQuestions: [...occasion.questions],
  };
}
