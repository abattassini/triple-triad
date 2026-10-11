import { Box } from '@mui/material';
import { Match as MatchComponent } from '../components/Match';

/**
 * The board, on its own. A duel owns the whole screen, so this page mounts no chrome and — since
 * `plans/PLAN-030-minimum-cards-and-board-menu/plan.md` — no hamburger drawer either: the ways off the board are the
 * in-board dialogs (*Back to Home* on the game-over and abandoned screens) and the browser's own back button.
 */
export const MatchPage: React.FC = () => {
  return (
    <Box>
      <MatchComponent />
    </Box>
  );
};
