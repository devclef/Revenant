/**
 * User-facing strings of the Write desk on /demo/live (spec 14, W2 and W3).
 * The eyebrow reuses LIVE_COPY.liveHeading and the Occasion labels come from
 * LIVE_COPY.occasionLabels, so only the strings new to the desk live here.
 *
 * Tone (tone.md) and neutrality (neutrality.md) apply: second person, short
 * sentences, no exclamation mark, no judgement of the letter.
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const DESK_COPY = {
  /** The h1 of the Write step (W2.3). */
  heading: "Write to the you who opens this.",
  /** The intro under the h1 (W2.4). */
  intro:
    "Say where things stand today. Then leave a few questions. When it opens, you answer them from memory first, then read what you wrote.",
  /** The visible legend above the Occasion pills (W3.1). */
  startFrom: "Start from",
  /** The salutation at the top of the Letter_Sheet (W4.2). Display only. */
  salutation: "Dear future me,",
  /** The sign-off under the Letter_Field (W4.4). Display only, never sealed. */
  signOff: "— me, today",
  /** The legend of the P.S. Question_Section (W6.2). */
  psLegend: "P.S. Questions for opening day",
  /** The intro under the P.S. legend (W6.3). */
  psIntro:
    "These stay on top of the envelope. When it opens, you answer each one from memory, before a word of the letter is shown. You don't answer them now.",
  /** Shown instead of the suggestion pills once three rows exist (W8.6). */
  questionsFull: "Three is the most a letter holds.",
  /** The placeholder of an empty Question_Row input (W7.1). */
  questionPlaceholder: "Write a question for opening day…",
  /** The visible label above an answer field (spec 15, R7.1). */
  answerLabel: "Your answer",
  /** The accessible name of an answer field, `{n}` its question number. */
  answerLabelFor: "Answer to question {n}",
  /** The placeholder of an empty answer field (spec 15, R7.1). */
  answerPlaceholder: "Answer it as you remember it today…",
  /** Named by the fold check on the first unanswered question, `{n}` its number (spec 15, R7.4). */
  answerMissing: "Question {n} has no answer yet. Answer it or remove it.",
  /** The visible text of the Edit control on a Question_Row (W7.4). */
  edit: "Edit",
  /** The Lock_Line under each Question_Row input (W7.5). */
  lockLine: "Answered on opening day, before the letter is shown.",
  /** The label above the Suggestion_Pills under the rows (W8.1). */
  askAnother: "Ask another:",
  /** The visible text of the last pill, after the hidden "+ " (W8.1, W8.7). */
  writeOwn: "Write my own",
  /** Accessible name of a Suggestion_Pill, with {text} the suggestion (W8.7). */
  addSuggestion: "Add the question: {text}",
  /** The eyebrow of the In_The_Envelope_Card, shown in capitals (W9.2). */
  inEnvelope: "In the envelope",
  /** The three Checklist_Line labels (W9.5). */
  checkLetter: "The letter",
  checkQuestions: "Questions on top",
  checkReceipt: "A receipt",
  /** The Fold_Button label, before its aria-hidden arrow (W13.1). */
  fold: "Fold it and press the seal",
  /** The one line under the Fold_Button after a failed fold (W13.3). */
  foldFailed: "Check the note above, then try again.",
  /** The heading of the receipt card (W10.2). It is not a "Receipts" heading. */
  receiptTitle: "Tuck in a receipt",
  /** The small label beside the card heading (W10.2). */
  optional: "Optional",
  /** The intro under the card heading (W10.2). */
  receiptIntro:
    "A number sealed with its date. When it opens, you guess it first, then see it next to today's.",
  /** The summary of the card below 600 px, which holds the heading (W10.2). */
  receiptSummaryPhone: "Tuck in a receipt (optional)",
  /** The first toggle button, the public figures view (W10.3). */
  togglePublic: "A public price",
  /** The second toggle button, the own number view (W10.3). */
  toggleOwn: "A number of my own",
  /** The visible text of the Details control under the Figure_Rows (W11.8). */
  details: "Details",
  /** The label above the own number name field (W12.1). */
  ownName: "What is it?",
  /** The placeholder of the own number name field (W12.1). */
  ownNamePlaceholder: "My rent",
  /** The label above the own number value field (W12.1). */
  ownAmount: "Amount",
  /** The label above the own number unit field (W12.1). */
  ownUnit: "Unit",
  /** The label above the own number region field (W12.1). */
  ownWhere: "Where?",
  /** The placeholder of the own number region field (W12.1). */
  ownWherePlaceholder: "My city",
  /** The sealing day under the own number fields, `{date}` a formatted day (W12.2). */
  dated: "Dated {date}",
  /** The self-reported line under the own number fields (W12.2). */
  ownMarked: "Marked self-reported. Revenant doesn't check it.",
  /** Names the empty fields of a partly filled own number (W12.4). `{fields}` is a list. */
  ownMissing: "Still to fill in: {fields}.",
} as const;
