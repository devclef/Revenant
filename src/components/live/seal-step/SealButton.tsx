// Feature: 20-easier-sealing-and-receipts (Part C).
//
// The Seal_Button: a second control that makes the same press as the wax. It is
// a native button with no pointer handlers, so a click, a Space or an Enter all
// reach the press through onActivate. It is not disabled: a blocked press is
// announced with aria-disabled and reports its attempt through onActivate.

import buttonStyles from "@/components/ui/buttons.module.css";

import styles from "./seal-step.module.css";

export type SealButtonProps = {
  /** The visible label, from sealButtonLabel. */
  label: string;
  /** True while the press is blocked (aria-disabled). */
  blocked: boolean;
  /** The id of the Press_Status_Line the button points to. */
  lineId: string;
  /** Runs the press once. */
  onActivate: () => void;
};

export function SealButton({
  label,
  blocked,
  lineId,
  onActivate,
}: SealButtonProps) {
  return (
    <button
      type="button"
      className={`${buttonStyles.primary} ${styles.sealButton}`}
      data-seal-button=""
      aria-disabled={blocked ? "true" : "false"}
      aria-describedby={lineId}
      onClick={onActivate}
    >
      {label}
    </button>
  );
}
