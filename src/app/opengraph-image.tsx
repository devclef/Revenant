// Feature: 08-judge-polish, 09-demo-polish (F2)
//
// The Open Graph image, 1200 x 630 (design.md "Icons and Open Graph"). It shows
// the Eyebrow and the Tagline from Brand_Copy beside the ghost. No text uses the
// Accent colour: orange means "you" on the page, and the image carries no
// orange text. It uses the default next/og font, so it adds no font file and no
// dependency.

import { ImageResponse } from "next/og";
import { BRAND_COPY } from "@/components/brand/copy";
import {
  BODY_PATH,
  EYE_CENTRES,
  EYE_RADII,
  FOLDS_PATH,
  VIEWBOX,
} from "@/components/ceremony/scene/ghost-geometry";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = BRAND_COPY.tagline;

/** Near-black background (--bg in tokens.css). */
const BG = "#0b0912";
/** Page text (--text in tokens.css) and the purple fold colour (--purple). */
const TEXT = "#f5f3ff";
/** Muted text (--muted in tokens.css), used for the Eyebrow. */
const MUTED = "#bdb4dc";
const PURPLE = "#8f46ff";

const NBSP = "\u00a0";

export default function OpenGraphImage() {
  // Keeps "Revenant doesn't." on one line, as the on-page headline does.
  const tagline = BRAND_COPY.tagline.replace("Revenant doesn't.", `Revenant${NBSP}doesn't.`);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: BG,
          padding: "0 96px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 680,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: MUTED,
              marginBottom: 24,
            }}
          >
            {BRAND_COPY.eyebrow}
          </span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              color: TEXT,
            }}
          >
            {tagline}
          </span>
        </div>
        <svg
          width="220"
          height="264"
          viewBox={VIEWBOX}
          style={{ flexShrink: 0 }}
        >
          <path d={BODY_PATH} fill="#ffffff" />
          <path
            d={FOLDS_PATH}
            fill="none"
            stroke={PURPLE}
            strokeWidth={7}
            strokeLinecap="round"
          />
          {EYE_CENTRES.map((c) => (
            <ellipse
              key={`${c.cx}-${c.cy}`}
              cx={c.cx}
              cy={c.cy}
              rx={EYE_RADII.rx}
              ry={EYE_RADII.ry}
              fill={BG}
            />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
