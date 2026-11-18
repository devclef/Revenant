import styles from "./desk.module.css";

export type StepHeaderProps = {
  /** The eyebrow text, shown in capitals by CSS. Omitted on the Seal step. */
  eyebrow?: string;
  /** The step's one h1. It receives focus on arrival (spec 14, S2.3). */
  heading: string;
  /** The intro under the h1. Omitted on the Seal step. */
  intro?: string;
  /** The id of the h1, so the page can link to or label it. */
  headingId: string;
};

/**
 * The header of a live step (spec 14, W2.1 to W2.4): the eyebrow, the one h1
 * and the intro. The Step_Track sits above it in LiveStepper. The h1 carries
 * `data-step-heading` and `tabIndex={-1}`, so LiveStepper can focus it. The
 * component renders no step-name h2 and no Live_Stepper heading.
 */
export function StepHeader({
  eyebrow,
  heading,
  intro,
  headingId,
}: StepHeaderProps) {
  return (
    <header className={styles.header}>
      {eyebrow !== undefined ? (
        <p className={styles.eyebrow}>{eyebrow}</p>
      ) : null}
      <h1
        id={headingId}
        className={styles.heading}
        data-step-heading=""
        tabIndex={-1}
      >
        {heading}
      </h1>
      {intro !== undefined ? <p className={styles.intro}>{intro}</p> : null}
    </header>
  );
}
