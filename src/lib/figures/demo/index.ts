// The demo figures, loaded once at import time (spec 02-demo-figures, Task 2;
// spec 04-real-figures, Task 9).
//
// This is the single import spec 03 (the persona demo) uses to get figures. It
// is the real figure file only, validated by loadFigureFile against the real
// CATALOGUE. The real file holds official weekly fuel prices, written by
// scripts/prefetch-figures, and every figure carries its own source, period,
// unit, region and retrieved_at.
//
// loadFigureFile throws FigureDataError on the first failed rule, so a bad file
// fails at import time, which means it fails tests and the build rather than
// shipping broken demo data.
//
// The US fuel fixture (src/lib/figures/demo/us-fuel.fixture.json) is no longer
// imported here. It stays in the repository for the fixture-shape tests, and
// nothing in the demo reads it through DEMO_FIGURES (R9.9, R9.11).
//
// Pure module: imports only the real JSON file and sibling figures modules
// (resolveJsonModule is enabled in tsconfig). Nothing from src/lib/sources/,
// src/lib/crypto, src/lib/db or Node built-ins, no network. Safe in the browser
// and on the server. The real file is imported only here (R13.3).

import type { LoadedFigures } from "../types";
import { CATALOGUE } from "../catalogue";
import { loadFigureFile } from "../load";

import realFile from "../real/fuel-figures.json";

/**
 * The demo figures: the real figure file, validated against the catalogue and
 * frozen. Loaded once at module import; a bad file throws here.
 */
export const DEMO_FIGURES: LoadedFigures = loadFigureFile(realFile, CATALOGUE);
