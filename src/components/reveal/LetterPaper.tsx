import {
  LetterBlock,
  type LetterBlockProps,
} from "@/components/ceremony/letter/LetterBlock";

/**
 * The letter on the receipts column (spec 15 R12.2). The paper holds the letter
 * in full, as it was sealed. The Caption_Block keeps the heading and the seal
 * date, and no fingerprint: the seal line (`SealLine`) now sits after the
 * figures and holds the fingerprint and the persona Tamper_Control.
 *
 * `LetterBlock` owns the paper's unfold and the stillness rules, so this
 * component only chooses what the column leaves out.
 */
export type LetterPaperProps = Omit<LetterBlockProps, "caption">;

export function LetterPaper(props: LetterPaperProps) {
  return <LetterBlock {...props} />;
}
