import { describe, expectTypeOf, it } from "vitest";
import type { PayloadV1 } from "@/lib/seal-format";
import type { OpenedPayload } from "./opened-payload";

describe("OpenedPayload", () => {
  it("accepts PayloadV1, so a v1 payload opens without a cast", () => {
    expectTypeOf<PayloadV1>().toMatchTypeOf<OpenedPayload>();
  });

  it("picks only the fields the opening screens read", () => {
    expectTypeOf<OpenedPayload>().toHaveProperty("letter_text");
    expectTypeOf<OpenedPayload>().toHaveProperty("written_as_of");
    expectTypeOf<OpenedPayload>().toHaveProperty("metrics");
    expectTypeOf<OpenedPayload>().toHaveProperty("figures");
    expectTypeOf<OpenedPayload>().toHaveProperty("recall_questions");
    expectTypeOf<OpenedPayload>().not.toHaveProperty("format_version");
  });
});
