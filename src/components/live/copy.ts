/**
 * User-facing strings for the live demo: the Seal_Page and the Letter_Page
 * pieces that share its copy file. Every string a reader sees comes from here
 * (R19.1), so none is a literal in a component.
 *
 * Tone (tone.md): calm, second person, short sentences, no exclamation marks,
 * the product words seal, sealed, open, letter, then and now. Neutrality
 * (neutrality.md): no party, policy, candidate or judgement, and each sentence
 * reads the same to any reader. Warnings about a lost passkey or key stay plain.
 *
 * `{name}` marks a value filled in at render time. The Demo_Index entry sits in
 * src/components/demo/copy.ts, not here.
 *
 * Hard constraints checked by copy.test.ts: no "!", no sentence over 25 words,
 * none of tone.md's clichés.
 *
 * Plain readonly constants only. No JSX lives here.
 */
export const LIVE_COPY = {
  heading: "Seal a letter of your own",
  intro:
    "This is a real sealed letter. It is locked for 30 seconds only because this is a demo. It opens with your own passkey.",
  letterLabel: "Your letter",
  letterHint: "Plain text. Up to 5,000 characters.",
  letterCount: "{count} of 5,000 characters",
  figuresLegend: "Choose the figures to seal with it",
  figuresHint:
    "Choose between 1 and 6. Each is sealed as published, with its period and source.",
  figureLatest: "Latest period: {period}",
  fixtureLabel: "fixture data",
  passkeySteps:
    'Your device will ask for the passkey twice. Each time, you press a button first. The passkey will be named "Revenant demo" in your passkey manager.',
  crossDevice:
    'A passkey may not work on a device from a different ecosystem. To open this letter, use a device that has the passkey, or your computer\'s "use a phone" option.',
  warning:
    "A lost or deleted passkey means this letter can never be opened. Revenant cannot recover it.",
  warningLabel:
    "I understand that a lost or deleted passkey means this letter can never be opened.",
  createButton: "Create your passkey",
  confirmButton: "Confirm your passkey",
  preparing: "Getting ready.",
  notYet: "Sealing opens soon.",
  stepCreating: "Waiting for your device. Create the passkey when it asks.",
  stepCreated: "Your passkey is created. Press the button to confirm it.",
  stepConfirming: "Waiting for your device. Confirm the passkey when it asks.",
  stepPreparing: "Preparing your letter.",
  stepSealing: "Sealing your letter.",
  letterEmpty:
    "Write something first. A letter needs at least one character that is not a space.",
  letterTooLong:
    "This letter is longer than 5,000 characters. Shorten it and try again.",
  figuresNone: "Choose at least one figure before you seal.",
  figuresTooMany: "Choose no more than 6 figures.",
  warningUnticked:
    "Tick the box to confirm you understand, then create your passkey.",
  unavailable:
    "Sealing your own letter is not available on this server. Go back to the demo.",
  cannotLockTitle: "This device cannot lock a letter with a passkey",
  cannotLockBody: "Your letter has not been sealed, and nothing was stored.",
  cannotLockNext1:
    'Try another device or browser. If your browser offers it, choose "use a phone or tablet".',
  cannotLockNext2:
    "You can also seal with a backup key instead, or open a persona letter.",
  passkeyDeleteNote:
    'If your device created a passkey named "Revenant demo", you can delete it from your passkey manager.',
  fallbackButton: "Seal with a backup key instead",
  backToDemo: "Back to the demo",
  cancelledTitle: "Nothing was sealed",
  cancelledBody:
    "You closed the prompt, or it timed out. Your letter is still here.",
  tryAgain: "Try again",
  failedBody:
    "Your letter was not sealed. Check your connection and try again.",
  clockBody:
    "Your device clock differs from Revenant's clock by more than the demo allows. Nothing was sealed. Check your device time and try again.",
  busyBody: "Demo 2 is busy right now. Nothing was sealed. Try again later.",
  missingThenBody:
    "No figure is available for {name}. Nothing was sealed. Choose different figures and try again.",
  fallbackTitle: "Your backup key",
  fallbackIntro:
    "This key is the only way to open this letter. Save it somewhere safe.",
  fallbackWarning: "A lost key means a lost letter. Revenant cannot recover it.",
  copyKey: "Copy",
  copied: "Copied",
  savedLabel: "I have saved this key",
  sealWithKey: "Seal with this key",
  notNow: "Not now",
  sealedTitle: "Your letter is sealed",
  sealedBody: "It cannot be changed now.",
  opensAt: "Opens at {time}",
  countdown: "Time remaining: {seconds} seconds.",
  countdownDone: "The time has come.",
  linkLabel: "Your letter link",
  copyLink: "Copy link",
  goToLetter: "Go to your letter",
  keepLink: "Keep this link. This page keeps nothing once you close it.",
  keyReminder:
    "This letter opens only with your backup key. Paste it into the key field on the letter page.",
  regionLabel: "Your letter",
  unlockTitle: "Unlock your letter",
  unlockPasskey: "Unlock with your passkey",
  unlockPreparing: "Getting ready.",
  backupOnly: "This letter needs its backup key. Paste it below.",
  backupLabel: "Backup key",
  backupHint: "Paste the key from your backup card.",
  backupSubmit: "Unlock with this key",
  noticeCancelled: "Nothing was opened. Press the button to try again.",
  noticeNoPrf:
    'This device could not produce the key for this passkey. Your letter is unchanged. Try a device that has the passkey, or your computer\'s "use a phone" option.',
  noticeWrongDomain:
    "This letter's passkey belongs to {domain}. The letter can only be unlocked there.",
  noticeWrongPasskey:
    "This is probably not the passkey that sealed this letter. Try another.",
  noticeMistyped: "That key does not look right. Check it and try again.",
  noticeWrongBackup: "That key does not match this letter.",
  sealedRemainingSeconds:
    "Time remaining: {minutes} minutes and {seconds} seconds.",
  sealedOn: "Sealed on {sealedAt}",
  lockNote:
    "This letter was locked for 30 seconds. For a longer comparison, open a persona letter.",
  lockNoteLink: "Open a persona letter",
  letterNotFound:
    "This link does not match a letter. Check the link and try again.",
} as const;
