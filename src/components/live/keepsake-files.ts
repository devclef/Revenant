// Helpers for the keepsakes on the sealed state (spec 06, task 11; R20.1,
// R20.4, R20.5, R20.6, design Part D). Everything here runs in the browser.
// Nothing is uploaded: the calendar file is built and saved from the click
// handler, and it holds the letter link and fixed event text only. It never
// holds letter text, figures or a key.

import { buildIcs } from "@/lib/ics";

import { LIVE_COPY } from "./copy";

/** The letter link as text. Built from APP_ORIGIN, never from the page URL. */
export function letterLinkText(appOrigin: string, letterId: string): string {
  return `${appOrigin}/l/${letterId}`;
}

/** The host of APP_ORIGIN, used as the UID domain. Falls back when the origin is not a URL. */
export function domainOf(appOrigin: string): string {
  try {
    return new URL(appOrigin).host;
  } catch {
    return "revenant";
  }
}

export interface KeepsakeIcsInput {
  letterId: string;
  appOrigin: string;
  /** The opening instant, an ISO 8601 string in UTC. */
  opensAt: string;
  /** The current instant as an ISO 8601 string, for DTSTAMP. */
  dtstamp: string;
}

/** The `.ics` text for a letter's opening date. */
export function buildKeepsakeIcs(input: KeepsakeIcsInput): string {
  const link = letterLinkText(input.appOrigin, input.letterId);
  return buildIcs({
    letterId: input.letterId,
    opensAt: input.opensAt,
    link,
    summary: LIVE_COPY.icsSummary,
    description: LIVE_COPY.icsDescription.replace("{link}", link),
    domain: domainOf(input.appOrigin),
    dtstamp: input.dtstamp,
  });
}

/** A file name that holds only letters, digits and hyphens. */
export function icsFileName(letterId: string): string {
  return `revenant-letter-${letterId.replace(/[^A-Za-z0-9-]/g, "")}.ics`;
}

/** The browser calls a download needs. A test passes fakes; the page uses the real ones. */
export interface DownloadEnv {
  makeBlob(text: string, type: string): Blob;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  clickDownload(href: string, filename: string): void;
}

/** Saves `text` as a file through a Blob and a temporary `<a download>`. Call it from a click handler. */
export function downloadTextFile(
  text: string,
  filename: string,
  type: string,
  env: DownloadEnv = browserDownloadEnv(),
): void {
  const url = env.createObjectURL(env.makeBlob(text, type));
  env.clickDownload(url, filename);
  env.revokeObjectURL(url);
}

function browserDownloadEnv(): DownloadEnv {
  return {
    makeBlob: (text, type) => new Blob([text], { type }),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    clickDownload: (href, filename) => {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
  };
}
