// One-off: copies the existing drawings out of src/ into assets.json so the
// prototype has no build dependency on src/. Run: npx tsx docs/design/15-flow/prep.ts
import { writeFileSync } from "node:fs";
import { sealSvgGroup } from "../../../src/components/ui/seal-relief/svg";
import * as g from "../../../src/components/ceremony/scene/ghost-geometry";
import { encodeQr, qrToSvg } from "../../../src/lib/cards/index";

const hashes = {
  maya: "5925def5dd62f6719db9f9bbc05fbbf210eac1fdd3d4c3018b3b97cb84a4728f",
  priya: "6524723dfb1ddefb0a4702bc4958fe74f60a9db3564148ec95986bc95e63e64c",
  live: "9c41e7a05b2d83f6a1d0c7e4b58f3a29d6e0b1c47f85a3d29e6b0c17a4f8d352",
};
const seals = Object.fromEntries(
  Object.entries(hashes).map(([k, h]) => [k, sealSvgGroup(h, 0, 0, 100)]),
);
const qr = (url: string) => qrToSvg(encodeQr(url, "M" as never));
let qrSvg = "";
try { qrSvg = qr("https://revenant.devclef.se/l/Qm7vXk2pTn9sLd4wRa8Hye"); } catch (e) { console.error(e); }
writeFileSync(new URL("./assets.json", import.meta.url), JSON.stringify({
  hashes, seals,
  ghost: { body: g.BODY_PATH, folds: g.FOLDS_PATH, viewBox: g.VIEWBOX, eyes: g.EYE_CENTRES, eyeR: g.EYE_RADII },
  qr: qrSvg,
}, null, 1));
