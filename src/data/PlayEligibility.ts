import { HAND_SIZE } from '../services/api';

/**
 * The collection a player needs before they can be in a match at all: one hand's worth
 * (plans/PLAN-030-minimum-cards-and-board-menu/plan.md). It mirrors the server's own rule —
 * `MatchEligibilityService.RequiredCards`, which is `GameLogicService.HandSize` — and is read from the profile the
 * client already carries (`Player.cardsOwned`), so the check needs no request of its own.
 */
export const MIN_CARDS_TO_PLAY = HAND_SIZE;

/**
 * The refusal sentence. It matches the server's `MatchEligibilityService.NotEnoughCardsMessage` word for word, so the
 * client's own check and a server refusal read identically instead of looking like two different problems.
 */
export const NOT_ENOUGH_CARDS_MESSAGE = `You need at least ${HAND_SIZE} different cards to play. Open a pack to get more.`;

/** Whether this player may start, join, or be invited to a match at all. */
export const canPlay = (cardsOwned: number | undefined): boolean =>
  (cardsOwned ?? 0) >= MIN_CARDS_TO_PLAY;
