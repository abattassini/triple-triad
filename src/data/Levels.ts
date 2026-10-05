// The level curve, in one place: there is no `Level` column on `Player` — the backend stores raw XP and the client
// derives the level — so every screen that shows one has to agree on the arithmetic. The stats panel
// (`PlayerStats.tsx`) keeps its own private copy of these two lines (PLAN-020 §5 D4 left that file untouched); this
// module is what a *new* consumer uses, so the curve is not re-derived a third time.
export const LEVEL_STEP = 100;

export const levelForXp = (xp: number): number => Math.floor(xp / LEVEL_STEP) + 1;

export const xpIntoLevel = (xp: number): number => xp % LEVEL_STEP;
