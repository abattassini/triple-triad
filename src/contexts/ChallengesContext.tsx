import { createContext, useContext } from 'react';

export interface ChallengesContextValue {
  /**
   * Begins inviting a friend (`plans/PLAN-027-friend-challenge/plan.md` §3.9,
   * `plans/PLAN-028-challenge-rules-and-friend-list/plan.md` §3.3): it opens the rule choice, and the call itself is
   * made once a rule set is picked. On success the "waiting for them to accept" dialog opens; on a refusal the same
   * dialog explains why.
   */
  challenge: (login: string) => void;

  /** True while the send call is in flight, so a caller's button can say so. */
  isChallenging: boolean;

  /**
   * Answers an invitation from **outside** the dialog — the bell's row (`accept`). The dialog answers through its own
   * buttons; both paths end in the same place, which is the Play page's picker. `false` means the answer was refused
   * (the match stopped being pending, or the player is still in one), so the caller can say so.
   */
  accept: (matchId: number) => Promise<boolean>;
}

/**
 * The challenge state, read through `useChallenges` below. The context and its hook live here and the provider lives in
 * `ChallengesProvider.tsx`, the same split `AuthContext`/`NotificationsContext` make: both halves have to exist, and
 * the `react-refresh` lint rule wants a module to export either components or values, not both.
 */
export const ChallengesContext = createContext<ChallengesContextValue | undefined>(undefined);

export const useChallenges = (): ChallengesContextValue => {
  const context = useContext(ChallengesContext);
  if (!context) {
    throw new Error('useChallenges must be used within a ChallengesProvider');
  }
  return context;
};
