// Short publisher names for the receipt rows and the Figure_Rows source line
// (spec 14, W10). Keys are the exact `source` strings of CATALOGUE in
// src/lib/figures/catalogue.ts. A source missing from this map is shown in full,
// never guessed at. Pure module: safe in the browser and in tests.

export const SHORT_PUBLISHERS: ReadonlyMap<string, string> = new Map([
  [
    "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
    "U.S. EIA",
  ],
  ["European Commission, Weekly Oil Bulletin", "EU Weekly Oil Bulletin"],
]);
