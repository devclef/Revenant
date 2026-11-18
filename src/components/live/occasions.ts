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
  /**
   * Shown in the empty letter field while this Occasion is chosen (spec 12,
   * W2). Display only: it is never stored, counted or sealed.
   */
  placeholder: string;
  /** The default question first, then up to two subject questions. */
  questions: readonly string[];
  /**
   * Extra questions the author may add as rows (spec 14, W8). Each names the
   * sealing day and never equals an entry in any Occasion's `questions`.
   */
  suggestions: readonly string[];
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
    placeholder: "This is where my year stands as I write this…",
    questions: [
      DEFAULT_QUESTION,
      "What did you hope the year would hold when you wrote this?",
      PREDICTION_QUESTION,
    ],
    suggestions: [
      "When you wrote this, which goal for the year felt most real to you?",
      "When you wrote this, what did you expect to be different by the day you opened it?",
    ],
  },
  {
    id: "work",
    label: "Work",
    starter:
      "This is what my work looks like as I write this, and what I am still working out.",
    placeholder: "This is what my work looks like as I write this…",
    questions: [
      DEFAULT_QUESTION,
      "What was on your mind about work when you wrote this?",
      PREDICTION_QUESTION,
    ],
    suggestions: [
      "When you wrote this, which piece of work were you most worried about?",
      "When you wrote this, what did you want your working week to look like?",
    ],
  },
  {
    id: "family",
    label: "Family",
    starter:
      "This is how things are with the people closest to me as I write this.",
    placeholder: "This is how things are with the people closest to me…",
    questions: [
      DEFAULT_QUESTION,
      "Who were you thinking about most when you wrote this?",
      PREDICTION_QUESTION,
    ],
    suggestions: [
      "When you wrote this, what did you most want to say to the people at home?",
      "When you wrote this, what did you hope the people closest to you would be doing?",
    ],
  },
  {
    id: "decision",
    label: "A decision",
    starter:
      "This is the decision in front of me, and where I lean as I write this.",
    placeholder: "This is the decision in front of me, and where I lean…",
    questions: [
      DEFAULT_QUESTION,
      "What were you weighing when you wrote this?",
      PREDICTION_QUESTION,
    ],
    suggestions: [
      "When you wrote this, what did you expect the choice to give you?",
      "When you wrote this, what would have made the decision feel settled?",
    ],
  },
  {
    id: "blank",
    label: "A blank page",
    starter: "",
    placeholder: "Write whatever you want to remember about today…",
    questions: [DEFAULT_QUESTION],
    suggestions: [
      "When you wrote this, what was the first thing you noticed that morning?",
      "When you wrote this, what would you most like to remember about that week?",
    ],
  },
];

/**
 * Suggestions every Occasion may offer after its own (spec 14, W8). Each names
 * the sealing day and never equals an Occasion question.
 */
export const SHARED_SUGGESTIONS: readonly string[] = [
  "When you wrote this, what was the small thing you were looking forward to?",
  "When you wrote this, who would you have called first with good news?",
  "What did you promise yourself the day you sealed this?",
];

/**
 * The letter field placeholder for an Occasion (spec 12, W2). Shown only while
 * the letter is empty, and never part of the letter's value.
 */
export function occasionPlaceholder(id: OccasionId): string {
  return findOccasion(id).placeholder;
}

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

  const questions = nextQuestionRows(
    draft.questions,
    draft.appliedQuestions,
    occasion,
  );

  return {
    text,
    questions,
    occasion: occasion.id,
    appliedStarter: occasion.starter,
    appliedQuestions: [...occasion.questions],
  };
}

/**
 * The question part of an Occasion pick, for /demo/live (spec 14, W3.3, W3.4).
 * It never reads or writes letter text, so the desk passes the text through
 * unchanged. `applyOccasion` stays as it is for /seal.
 */
export type OccasionQuestionsDraft = {
  questions: string[];
  occasion: OccasionId;
  appliedQuestions: readonly string[];
};

/**
 * Applies an Occasion to the question rows only (steps 2 and 3 of
 * `applyOccasion`). A row the visitor typed is kept in place. An empty, missing
 * or still-applied row takes the new Occasion's question at that index.
 */
export function applyOccasionQuestions(
  draft: OccasionQuestionsDraft,
  id: OccasionId,
): OccasionQuestionsDraft {
  const occasion = findOccasion(id);
  return {
    questions: nextQuestionRows(
      draft.questions,
      draft.appliedQuestions,
      occasion,
    ),
    occasion: occasion.id,
    appliedQuestions: [...occasion.questions],
  };
}

/**
 * The row rule shared by `applyOccasion` and `applyOccasionQuestions`: each
 * row index 0 to 2 takes the Occasion's question at that index only when the
 * row is empty, missing or still the previously applied question. Typed rows
 * stay. Rows are compacted in order, and the default question fills in when
 * none are left.
 */
function nextQuestionRows(
  questions: readonly string[],
  appliedQuestions: readonly string[],
  occasion: Occasion,
): string[] {
  const rows: string[] = [];
  for (let i = 0; i < OCCASION_QUESTIONS_MAX; i += 1) {
    const current = questions[i];
    const previous = appliedQuestions[i];
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

  return rows.length > 0
    ? rows.slice(0, OCCASION_QUESTIONS_MAX)
    : [DEFAULT_QUESTION];
}
