# Owner check and QA run: spec 06, lock and unlock (Demo 2)

Issue body for task 10 (R23, R24). Source: `.kiro/specs/06-lock-and-unlock/tasks.md` ("Owner check on the live site") and `.kiro/specs/06-lock-and-unlock/design.md` ("QA browser steps" and "Owner check on the live site (R23)").

This file is the text the dispatcher posts as the GitHub issue body. The agent does not post it.

## Part 1: Owner check on the live site

Do this by hand on `https://revenant.devclef.se` with a device that supports PRF. The QA agent cannot do these steps.

- [ ] 1. Open `/demo`, follow the Demo 2 link, write a short letter, pick two series, tick the lost-passkey warning and press "Create your passkey".
- [ ] 2. Approve the first prompt, press "Confirm your passkey", approve the second. Check a passkey named "Revenant demo" appears in the passkey manager.
- [ ] 3. Check the sealed state counts down from 30 seconds and shows no letter text.
- [ ] 4. Press the letter link before the countdown ends. Check it says "still sealed" and shows the time remaining.
- [ ] 5. After the countdown, press "Unlock with your passkey". Check the seal-is-intact statement comes before the recall questions.
- [ ] 6. Answer the questions and finish the reveal. Check the letter text matches what was typed, each figure shows its period, and the change is 0.
- [ ] 7. Open the Letter_Page on a device without the passkey, or in a browser without PRF, and check the message is clear. Then, in a browser without PRF, choose "Seal with a backup key instead", save the key, tick "I have saved this key", seal, and after the countdown paste the key and open the letter.
- [ ] 8. Open `/demo/personas/us-maya` and check Demo 1 opens as before.
- [ ] 9. If tasks 11 and 12 are built: print or save the letter card and the backup key card, scan both QR codes with a phone, and check each opens the right page. The key card must also open the letter after the opening date.
- [ ] 10. Record device, operating system, browser and passkey provider used in step 1 (R23.1, R23.3): ______________________________________

- [ ] Delete the Revenant demo passkeys made during the check (R23.4).

## Part 2: QA run with a stubbed WebAuthn

The QA agent runs these steps against a local build. No authenticator exists in its browser, so it installs a fake `navigator.credentials` in the page. The real crypto, real routes and real database all run.

### Setup

1. Start Postgres, run `npm run db:migrate`, run `npm run seal-personas`.
2. Start the app on the QA random port: `RP_ID=localhost APP_ORIGIN=http://localhost:<port> PORT=<port> npm start`.
3. Install the stub on `/demo/live` (or `/l/<id>`) with `browser_evaluate`, after the page loads and before the press. A full page load removes it, so reinstall after any navigation that is not client-side. The full script is in `.kiro/specs/06-lock-and-unlock/design.md`, section "Stubbing WebAuthn and the routes".
4. Stub modes, set with `__qa.mode`:
   - `ok`: normal PRF result on create and get.
   - `get-only`: no PRF result on create. Still passes, because only `get` must return a PRF result.
   - `no-prf`: no PRF result on either call.
   - `short`: PRF result of 31 bytes.
   - `cancel`: create throws `NotAllowedError`.
   - `cancel-get`: get throws `NotAllowedError`.
5. Route stubs: `__qa.status["/api/letters/demo/seal"] = { status: 429, body: '{"error":"busy"}' }`.
6. `__qa.log` records each create, get and fetch call in order. `__qa.creates` and `__qa.gets` count the calls.
7. Time to open a letter is 30 seconds. Wait 31 seconds by the page clock before the letter step.
8. Screenshots go to `<qa-shots>/pr-<number>/<nn>-<name>[-360].png`.

### Steps

| # | Step | What to do | Wait for |
|---|---|---|---|
| 01 | Entry | Open `/demo`. Check the "Seal your own letter" entry is outside the persona list and links to `/demo/live`. Screenshot at 1280 and 360. | the link |
| 02 | Write | Open `/demo/live`. Check the Demo label first, the note, the field with its count, the figure list (fixture series carry "fixture data"), the two-prompt explanation, the warning and its checkbox. | `[data-live-step="write"]` |
| 03 | Validation | Install the stub. Press "Create your passkey" with an empty letter, then with text and no figure, then with a figure and the box unticked. Check each message, the text kept, and `__qa.log` empty. | the message |
| 04 | Create press | Fill everything, tick the box, press "Create your passkey". Check `__qa.creates === 1`, no fetch in the log, status "Waiting for your device". | `[data-live-step="created"]` |
| 05 | Confirm press | Check "Confirm your passkey" is shown and `__qa.gets === 0` (nothing starts by itself). Press it. | `[data-live-step="sealed"]` |
| 06 | Order | Read `__qa.log`. Check the order is `create`, `get`, `fetch /api/letters/demo/prepare`, `fetch /api/letters/demo/seal` and nothing else. | the log |
| 07 | Sealed | Check the sealed statement, the local opening time, the countdown, the link as text with Copy, and no letter text or figure value anywhere in the DOM (search the typed text). Screenshot. | `[data-live-step="sealed"]` |
| 08 | Early | Within 30 seconds open the letter link in a new browser tab, and keep the sealed page open in the first tab. Check "Still sealed", the date, the time remaining, and nothing about contents. | `[data-ceremony="envelope"]` |
| 09 | Unlock | After 31 seconds, return to the first tab and press "Go to your letter" on the sealed page. This is a client-side `next/link` navigation, so the stub and `__qa.rawId` survive. Press "Unlock with your passkey". | `[data-ceremony="intact"]` |
| 10 | Intact first | Check the seal-is-intact statement came before any recall question. Press "Begin". | `[data-ceremony="recall"]` |
| 11 | Recall and reveal | Answer, submit, break the seal, read the letter and the numbers. Check the letter text equals what was typed, each figure shows period, region and unit, the change is 0, and "Sealed on" shows. No "Prepared later as a demo". The live note links to `/demo`. | `[data-ceremony="close"]` |
| 12 | Calm | Repeat 04 to 11 with "Turn off motion" on and the keyboard only. | each stage |
| 13 | Unsupported | Reload `/demo/live`, install the stub, set `__qa.mode = "no-prf"`, fill the form and press both buttons. Check the cannot-lock screen, the fallback control, the passkey-deletion note, and no fetch in the log. Repeat with `"short"`. (`"get-only"` still passes.) | `[data-live-step="cannot_lock"]` |
| 14 | Cancelled | `__qa.mode = "cancel"`. Check the calm message, the text kept, and "Try again". Repeat with `"cancel-get"`. | `[data-live-step="cancelled"]` |
| 15 | Backup fallback | From 13, press "Seal with a backup key instead". Check the key in groups of four, the loss warning, and that the seal button is disabled until "I have saved this key" is ticked. Tick it, then seal. | `[data-live-step="sealed"]` |
| 16 | Backup open | Copy the key before sealing. After 31 seconds open the letter through "Go to your letter". Check there is no passkey control, only the key field. Paste the key (grouped, lower case). | `[data-ceremony="intact"]` |
| 17 | Mistyped | Change one character of the key. Check the mistyped message and that `__qa.log` shows no new fetch. | the message |
| 18 | Wrong key | Paste a valid key from another letter. Check "That key does not match this letter." and that the field stays. | the message |
| 19 | Wrong domain | Seal on `localhost`. Open `http://127.0.0.1:<port>/l/<id>`, install the stub, then press the passkey control. Check the message names `localhost` and `__qa.gets === 0`. | the message |
| 20 | Busy and clock | Stub the seal route with 429 `busy`, then 422 `lock_out_of_range`, then a network failure. Check each message says nothing was sealed and offers "Try again". | the message |
| 21 | Double press | Press "Create your passkey" twice quickly. Check `__qa.creates === 1`. | the log |
| 22 | 360 width | Repeat 02, 04, 07, 09, 10 and 11 at 360 by 640. | each stage |
| 23 | Persona regression | Open `/demo/personas/us-maya` and complete it. Check it uses the demo key, shows no passkey control and shows "Sealed for the demo on". | `[data-ceremony="close"]` |

After a full page load, reinstall the stub and continue. The stub's PRF depends only on the salt, so unlock still works. That is not a finding.

`RP_ID` unset (the `unavailable` screen) is covered by unit tests only.

Owner check status for the QA agent: record "owner check pending" until Part 1 is ticked.
