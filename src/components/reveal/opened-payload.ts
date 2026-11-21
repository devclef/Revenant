// The part of a sealed payload that the opening screens read. It is a
// structural subset, so any payload version that carries these fields
// satisfies it. The opening code never needs to know which version it holds.
//
// A version 2 text question also carries `sealed_answer`, the author's answer
// written on the sealing day. A version 1 text question does not. Both are
// accepted here, and `sealedAnswerOf` (receipts.ts) reads the answer when present.
//
// Types only. This module has no runtime behaviour.

import type { PayloadV1, PayloadV2 } from "@/lib/seal-format";

/** A recall question from any payload version the reveal can open. */
export type OpenedRecallQuestion =
  | PayloadV1["recall_questions"][number]
  | PayloadV2["recall_questions"][number];

export type OpenedPayload = Pick<
  PayloadV1,
  "letter_text" | "written_as_of" | "metrics" | "figures"
> & {
  recall_questions: OpenedRecallQuestion[];
};
