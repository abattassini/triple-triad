import type { MatchRule } from '../services/api';

/**
 * Display names for the backend's rule names — SAME, PLUS, SAME WALL, PLUS WALL — and the one place a rule list is
 * turned into words (plans/PLAN-028-challenge-rules-and-friend-list/plan.md §3.5 D8). It lives in a data module rather
 * than beside a component because the board's chips, the Play rule choice, the searching line and the challenge dialogs
 * all read it, and a `.tsx` may not export a plain value (the `react-refresh` rule) — the same reason `cardArtUrl`
 * lives in `src/data/CardArt.ts`.
 */
const RULE_LABELS: Partial<Record<MatchRule, string>> = {
  Same: 'SAME',
  Plus: 'PLUS',
  SameWall: 'SAME WALL',
  PlusWall: 'PLUS WALL',
};

/** One rule's display name; an unknown rule (one added later on the backend) falls back to its upper-cased name. */
export const ruleLabel = (rule: string): string =>
  RULE_LABELS[rule as MatchRule] ?? rule.toUpperCase();

/**
 * A whole rule list as one line: `SAME · PLUS · SAME WALL · PLUS WALL`. An **empty** list is deliberately not this
 * helper's business — a basic match reads "no special rules", a sentence each caller words for its own context.
 */
export const describeRules = (rules: MatchRule[]): string => rules.map(ruleLabel).join(' · ');
