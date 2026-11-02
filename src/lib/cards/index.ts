export { encodeQr, type QrMatrix } from "./qr/encode";
export type { QrLevel } from "./qr/tables";
export { qrToSvg, qrPath, DEFAULT_QUIET_ZONE, type QrPath, type QrSvgOptions } from "./qr-svg";
export { readKeyFragment, stripFragment, takeBackupKeyFromLocation } from "./fragment";
