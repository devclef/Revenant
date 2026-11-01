// The demo figures, loaded once at import time (spec 02-demo-figures, Task 2;
// spec 04-real-figures, Task 7).
//
// This is the single import spec 03 (the persona demo) uses to get figures. It
// merges two figure files, both validated by loadFigureFile against the real
// CATALOGUE:
//   - the real figure file (official weekly fuel prices, written by
//     scripts/prefetch-figures), and
//   - the US fuel fixture JSON.
// loadFigureFile throws FigureDataError on the first failed rule, so a bad file
// fails at import time, which means it fails tests and the build rather than
// shipping broken demo data.
//
// The fixture carries a visible "fixture" flag and FIXTURE source/series_id on
// every metric and figure (data-integrity.md). mergeLoadedFigures keeps that
// flag, so the merged set is fixture as soon as any input is. Each fixture
// figure keeps its own FIXTURE-prefixed metric and source, so it can never be
// mistaken for real data.
//
// Pure module: imports only the two JSON files and sibling figures modules
// (resolveJsonModule is enabled in tsconfig). Nothing from src/lib/sources/,
// src/lib/crypto, src/lib/db or Node built-ins, no network. Safe in the browser
// and on the server. The real file is imported only here (R13.3).

import type { LoadedFigures } from "../types";
import { CATALOGUE } from "../catalogue";
import { loadFigureFile } from "../load";
import { mergeLoadedFigures } from "../merge";

import realFile from "../real/fuel-figures.json";
import fixture from "./us-fuel.fixture.json";

/**
 * The demo figures: the real figure file and the US fuel fixture, each
 * validated against the catalogue and frozen, then merged. Loaded once at
 * module import; a bad file throws here.
 */
export const DEMO_FIGURES: LoadedFigures = mergeLoadedFigures(
  loadFigureFile(realFile, CATALOGUE),
  loadFigureFile(fixture, CATALOGUE),
);
