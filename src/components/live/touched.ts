/**
 * Per-field touched state for the Seal_Page (spec 09, A4.4).
 *
 * A field's validation message shows only after the judge has changed or left
 * that field (`touched`), or after the judge has tried to seal or leave the
 * step (`attempted`). On first load nothing is touched, so no message shows.
 *
 * Pure and immutable: each function returns a new state, so a React reducer
 * or a plain `useState` updater can use it directly.
 */

export interface TouchedState {
  /** Fields the judge has changed or left. */
  readonly touched: Readonly<Record<string, true>>;
  /** True once the judge has tried to seal or to leave the step. */
  readonly attempted: boolean;
}

export const INITIAL_TOUCHED: TouchedState = {
  touched: {},
  attempted: false,
};

/** Record that the judge changed or left `field`. */
export function markTouched(state: TouchedState, field: string): TouchedState {
  if (state.touched[field] === true) return state;
  return { ...state, touched: { ...state.touched, [field]: true } };
}

/** Record that the judge tried to seal or to leave the step. */
export function markAttempted(state: TouchedState): TouchedState {
  if (state.attempted) return state;
  return { ...state, attempted: true };
}

/** True when a validation message for `field` may show. */
export function showsFieldMessage(state: TouchedState, field: string): boolean {
  return state.attempted || state.touched[field] === true;
}
