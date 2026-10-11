import { Alert, Box, Button } from '@mui/material';
import { FiGift } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { NOT_ENOUGH_CARDS_MESSAGE } from '../data/PlayEligibility';

/**
 * Why a match cannot be started yet, and the one thing that fixes it: the packs a new account is created with are
 * waiting on My Packs.
 *
 * It is rendered where the attempt was made — above Play's tiles, or by `ChallengesProvider` when a challenge is the
 * attempt — so the reason and the way out are on screen together rather than only arriving as a server error
 * (plans/PLAN-030-minimum-cards-and-board-menu/plan.md).
 */
export const NotEnoughCardsNotice: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();

  return (
    <Alert severity="warning" className="not-enough-cards" onClose={onClose} sx={{ mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <span>{NOT_ENOUGH_CARDS_MESSAGE}</span>
        <Button
          variant="contained"
          size="small"
          startIcon={<FiGift />}
          onClick={() => navigate('/packs')}
        >
          Open packs
        </Button>
      </Box>
    </Alert>
  );
};
