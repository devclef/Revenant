// A standalone SVG of the letter card (spec 08 R14.1, R14.2, R14.7). The card
// behind "Save the card as an image": it draws the QR symbol, the card title,
// the opening date, the letter link and the sealing Fingerprint as SVG text,
// and nothing else. No key and no letter content.
//
// This builds an SVG string by hand. It adds no raster library and loads no
// image: the only drawing primitives are the one QR `<path>` (reused from
// `qrPath`) and `<text>` elements, so the saved file is pure vector markup the
// browser already renders (R14.1, R14.2).
//
// Colours are literal black on white so the saved image reads the same anywhere,
// independent of the page's CSS tokens. The Fingerprint and the link are drawn
// in a monospace / sans face at a size that keeps the hex readable. Every text
// value is XML-escaped, so a value can never break out of the markup.
//
// This module imports only `qr-svg` (pure). It is safe in the browser.

import type { QrPath } from "./qr-svg";

/** The strings and QR path a letter card SVG is drawn from. */
export interface LetterCardSvgInput {
  /** The QR path and side (in modules, including the quiet zone) from `qrPath`. */
  qr: QrPath;
  /** The card title, e.g. "Letter card". */
  title: string;
  /** The opening-date line, already formatted, e.g. "Opens 30 October 2026, 12:00 CET". */
  opensLabel: string;
  /** The letter link, e.g. "https://revenant.devclef.se/l/abc". */
  link: string;
  /** The Fingerprint label, e.g. "Fingerprint at sealing". */
  fingerprintLabel: string;
  /** The Fingerprint: 16 space-separated groups of 4 hex characters, from `formatFingerprint`. */
  fingerprint: string;
}

// Card geometry, in user units. The viewBox is fixed; the QR is scaled to fit
// its box, so a longer or shorter link never changes the card's size.
const CARD_WIDTH = 480;
const CARD_HEIGHT = 560;
const PADDING = 32;
const QR_BOX = CARD_WIDTH - PADDING * 2;

/** Escapes a value for XML text or an attribute: `&`, `<`, `>`, `"` and `'`. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Splits a fingerprint of 16 groups into its first and second line of 8 groups. */
function fingerprintLines(fingerprint: string): [string, string] {
  const groups = fingerprint.split(" ");
  return [groups.slice(0, 8).join(" "), groups.slice(8).join(" ")];
}

/**
 * Builds a self-contained SVG string for the letter card. The QR is drawn as a
 * black path on a white rounded rectangle, scaled to fill `QR_BOX`; the title,
 * opening date, link and Fingerprint follow as `<text>` lines. No raster image
 * and no third-party asset.
 */
export function letterCardSvg(input: LetterCardSvgInput): string {
  const { qr, title, opensLabel, link, fingerprintLabel, fingerprint } = input;
  const [lineOne, lineTwo] = fingerprintLines(fingerprint);

  // The QR path is in module units; scale it to QR_BOX and offset it below the
  // title. A quiet zone is already part of `qr.side`.
  const qrScale = QR_BOX / qr.side;
  const qrTop = PADDING + 36;

  const sans =
    "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const mono = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

  const linkY = qrTop + QR_BOX + 44;
  const fpLabelY = linkY + 48;
  const fpLineOneY = fpLabelY + 28;
  const fpLineTwoY = fpLineOneY + 24;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" `,
    `width="${CARD_WIDTH}" height="${CARD_HEIGHT}" role="img" aria-label="${escapeXml(title)}">`,
    `<rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="8" fill="#ffffff"/>`,
    `<text x="${PADDING}" y="${PADDING + 20}" font-family="${sans}" font-size="22" font-weight="600" fill="#000000">`,
    `${escapeXml(title)}</text>`,
    // The QR on its own white box, scaled from module units to the card.
    `<g transform="translate(${PADDING} ${qrTop}) scale(${qrScale})">`,
    `<path fill="#000000" d="${qr.d}"/>`,
    `</g>`,
    `<text x="${PADDING}" y="${qrTop + QR_BOX + 16}" font-family="${sans}" font-size="16" fill="#000000">`,
    `${escapeXml(opensLabel)}</text>`,
    `<text x="${PADDING}" y="${linkY}" font-family="${sans}" font-size="14" fill="#000000">`,
    `${escapeXml(link)}</text>`,
    `<text x="${PADDING}" y="${fpLabelY}" font-family="${sans}" font-size="12" font-weight="600" fill="#000000" letter-spacing="1">`,
    `${escapeXml(fingerprintLabel.toUpperCase())}</text>`,
    `<text x="${PADDING}" y="${fpLineOneY}" font-family="${mono}" font-size="16" fill="#000000" xml:space="preserve">`,
    `${escapeXml(lineOne)}</text>`,
    `<text x="${PADDING}" y="${fpLineTwoY}" font-family="${mono}" font-size="16" fill="#000000" xml:space="preserve">`,
    `${escapeXml(lineTwo)}</text>`,
    `</svg>`,
  ].join("");
}
