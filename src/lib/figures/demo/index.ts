// The demo figures, loaded once at import time (spec 02-demo-figures, Task 2).
//
// This is the single import spec 03 (the persona demo) uses to get figures: it
// imports the US fuel fixture JSON and runs it through loadFigureFile against
// the real CATALOGUE, so the fixture is validated exactly like real data.
// loadFigureFile throws FigureDataError on the first failed rule, so a bad
// fixture fails at import time — which means it fails tests and the build
// rather than shipping broken demo data.
//
// The fixture carries a visible "fixture" flag and FIXTURE source/series_id on
// every metric and figure (data-integrity.md), so these numbers can never be
// mistaken for real figures.
//
// Pure module: imports only the fixture JSON and sibling figures modules
// (resolveJsonModule is enabled in tsconfig). Nothing from src/lib/crypto,
// src/lib/db or Node built-ins, no network. Safe in the browser and on the
// server.

import type { LoadedFigures } from "../types";
import { CATALOGUE } from "../catalogue";
import { loadFigureFile } from "../load";

import fixture from "./us-fuel.fixture.json";

/**
 * The demo figures: the US fuel fixture validated against the catalogue and
 * frozen. Loaded once at module import; a bad fixture throws here.
 */
export const DEMO_FIGURES: LoadedFigures = loadFigureFile(fixture, CATALOGUE);
