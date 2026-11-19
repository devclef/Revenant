// The part of a sealed payload that the opening screens read. It is a
// structural subset, so any payload version that carries these fields
// satisfies it. The opening code never needs to know which version it holds.
//
// Types only. This module has no runtime behaviour.

import type { PayloadV1 } from "@/lib/seal-format";

export type OpenedPayload = Pick<
  PayloadV1,
  "letter_text" | "written_as_of" | "metrics" | "figures" | "recall_questions"
>;
