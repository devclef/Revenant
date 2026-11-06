// Feature: 08-judge-polish
//
// The 180 x 180 Apple touch icon (design.md "Icons and Open Graph"). It draws
// the Ghost from the shared geometry in ghost-geometry.ts, so it matches the
// on-page Ghost. It is this repository's own drawing (ASSETS.md): a plain sheet
// ghost, not Kiro's logo or mascot. Nothing is loaded from outside the app.

import { ImageResponse } from "next/og";
import {
  BODY_PATH,
  EYE_CENTRES,
  EYE_RADII,
  FOLDS_PATH,
  VIEWBOX,
} from "@/components/ceremony/scene/ghost-geometry";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Near-black background (--bg in tokens.css). */
const BG = "#0b0912";
/** The ghost fill (--ghost-top) and the purple fold colour (--purple). */
const GHOST = "#ffffff";
const PURPLE = "#8f46ff";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          borderRadius: 32,
        }}
      >
        <svg width="132" height="158" viewBox={VIEWBOX}>
          <path d={BODY_PATH} fill={GHOST} />
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
