import type { QrMatrix } from "./qr/encode";

export const DEFAULT_QUIET_ZONE = 4;

export interface QrSvgOptions {
  /** Light modules around the symbol. The QR standard asks for 4. */
  quiet?: number;
}

/**
 * Renders a QR matrix as one `<svg>` holding a single `<path>`. Each run of
 * dark modules is one unit-height rectangle, so the file stays small and the
 * edges stay sharp when printed. The background is left to the page: this
 * draws dark modules only, and the surrounding quiet zone is transparent.
 */
export function qrToSvg(matrix: Pick<QrMatrix, "size" | "modules">, options: QrSvgOptions = {}): string {
  const quiet = options.quiet ?? DEFAULT_QUIET_ZONE;
  if (!Number.isInteger(quiet) || quiet < 0) {
    throw new RangeError("quiet zone must be a non-negative integer");
  }
  const { size, modules } = matrix;
  const side = size + 2 * quiet;

  let d = "";
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!modules[row][col]) {
        col++;
        continue;
      }
      const start = col;
      while (col < size && modules[row][col]) col++;
      d += `M${start + quiet} ${row + quiet}h${col - start}v1h-${col - start}z`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" ` +
    `width="${side}" height="${side}" shape-rendering="crispEdges" role="img">` +
    `<path fill="#000" d="${d}"/>` +
    `</svg>`
  );
}
