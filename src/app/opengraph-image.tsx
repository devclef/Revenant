// Feature: 08-judge-polish
//
// The Open Graph image, 1200 x 630 (design.md "Icons and Open Graph"). It shows
// the landing headline, with "receipts." in the Accent colour (orange means
// "you", tone.md). It uses the default next/og font, so it adds no font file
// and no dependency. The headline text comes from SCENE_COPY, the same source
// as the on-page headline.

import { ImageResponse } from "next/og";
import { SCENE_COPY } from "@/components/ceremony/scene/copy";
import {
  BODY_PATH,
  EYE_CENTRES,
  EYE_RADII,
  FOLDS_PATH,
  VIEWBOX,
} from "@/components/ceremony/scene/ghost-geometry";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SCENE_COPY.headlineLead} ${SCENE_COPY.headlineAccent}`;

/** Near-black background (--bg in tokens.css). */
const BG = "#0b0912";
/** Page text (--text in tokens.css) and the purple fold colour (--purple). */
const TEXT = "#f5f3ff";
const PURPLE = "#8f46ff";
/** The Accent colour (--accent in tokens.css), used only on "receipts.". */
const ACCENT = "#ff7b1c";

export default function OpenGraphImage() {
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
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 1.05,
            color: TEXT,
          }}
        >
          <span>{SCENE_COPY.headlineLead}</span>
          <span style={{ color: ACCENT }}>{SCENE_COPY.headlineAccent}</span>
        </div>
        <svg width="260" height="312" viewBox={VIEWBOX}>
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
