/**
 * Occasions for the Write step (spec 11-any-letter, L2): a letter starter and
 * one default Author_Question per Occasion, so an author is not facing a blank
 * page. The rest are suggestions the author may add. The wording is the README
 * table "Question wording (Occasions)" (docs/design/15-flow/README.md), in the
 * author's own voice and present tense (spec 15, R8.1 to R8.3).
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
  /**
   * The default question, one row by default (spec 15, R8.1). A list, so the
   * row rules in `nextQuestionRows` read it the same way as before.
   */
  questions: readonly string[];
  /**
   * The Occasion's own suggestions, offered after its default question (spec
   * 15, R8.1). Each is first person and present tense.
   */
  suggestions: readonly string[];
}

/**
 * The question a blank draft starts with (L1.2). It is the blank page's default
 * question from the README table, in the author's own voice.
 */
export const DEFAULT_QUESTION = "What is on my mind right now?";

/** The most Author_Questions a letter may hold (L1.1, L2.8). */
export const OCCASION_QUESTIONS_MAX = 3;

/** The Occasion_Table (README "Question wording (Occasions)"). */
export const OCCASIONS: readonly Occasion[] = [
  {
    id: "year",
    label: "The year ahead",
    starter: "This is where my year stands as I write this.",
    placeholder: "This is where my year stands as I write this…",
    questions: ["What do I hope this year holds?"],
    suggestions: [
      "Which goal for the year feels most real to me?",
      "What do I think will be different by the day I open this?",
    ],
  },
  {
    id: "work",
    label: "Work",
    starter:
      "This is what my work looks like as I write this, and what I am still working out.",
    placeholder: "This is what my work looks like as I write this…",
    questions: ["What is on my mind about work right now?"],
    suggestions: [
      "What worries me most right now?",
      "What do I want my working week to look like?",
      "What do I think will be different by the day I open this?",
    ],
  },
  {
    id: "family",
    label: "Family",
    starter:
      "This is how things are with the people closest to me as I write this.",
    placeholder: "This is how things are with the people closest to me…",
    questions: ["Who am I thinking about most right now?"],
    suggestions: [
      "What do I most want to say to the people at home?",
      "What do I hope the people closest to me are doing when I open this?",
    ],
  },
  {
    id: "decision",
    label: "A decision",
    starter:
      "This is the decision in front of me, and where I lean as I write this.",
    placeholder: "This is the decision in front of me, and where I lean…",
    questions: ["What am I weighing right now?"],
    suggestions: [
      "What do I expect the choice to give me?",
      "What would make this decision feel settled for me?",
    ],
  },
  {
    id: "blank",
    label: "A blank page",
    starter: "",
    placeholder: "Write whatever you want to remember, in your own words…",
    questions: [DEFAULT_QUESTION],
    suggestions: [
      "What did I notice first this morning?",
      "What do I most want to remember about this week?",
    ],
  },
];

/**
 * Suggestions every Occasion may offer after its own (README table, "Shared,
 * after the Occasion's own"). None equals an Occasion question.
 */
export const SHARED_SUGGESTIONS: readonly string[] = [
  "What small thing am I looking forward to?",
  "Who would I call first with good news?",
  "What have I promised myself?",
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
