import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import RedeemIcon from '@mui/icons-material/Redeem';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { useNavigate } from 'react-router-dom';
import { PackRevealModal } from './PackRevealModal';
import { cardBackUrl } from '../data/CardArt';
import type { PackCard, PackStack } from '../services/api';
import './PackOpener.scss';

// What a page says once there is nothing left to open: My Packs points at the shop that sells packs, the Welcome
// page sends the player on to the Lobby.
const EMPTY_STATES = {
  shop: {
    title: "You don't have any packs yet",
    caption: 'Packs are how a collection starts — five random cards for 1,500 coins.',
    action: 'Go to the Card Shop',
    to: '/shop',
    icon: <StorefrontIcon />,
  },
  lobby: {
    title: "You've opened every pack",
    caption: 'Your cards are waiting in your collection — open My Cards to see what you drew.',
    action: 'Continue to the Lobby',
    to: '/lobby',
    icon: <HomeIcon />,
  },
} as const;

interface PackOpenerProps {
  /** The stacks the player holds; the first one is the pack the panel opens. */
  packs: PackStack[];
  /** Every pack across those stacks — the "N waiting" the panel shows. */
  totalPacks: number;
  /** The cards the last open handed out, replayed face-down by the reveal. */
  cards: PackCard[];
  isRevealing: boolean;
  isLoading: boolean;
  isOpening: boolean;
  error: string | null;
  /** Which empty state to show once the player holds nothing. */
  emptyState: keyof typeof EMPTY_STATES;
  onOpen: () => void;
  onDismissReveal: () => void;
  onClearError: () => void;
  className?: string;
}

/**
 * The pack panel: the unopened pack with its **Open pack** button, the reveal that plays after an open, and the
 * error/loading/empty states around them. It renders state only — `usePackInventory` owns the calls — which is
 * what lets My Packs and the Welcome page offer the exact same opening flow.
 */
export const PackOpener: React.FC<PackOpenerProps> = ({
  packs,
  totalPacks,
  cards,
  isRevealing,
  isLoading,
  isOpening,
  error,
  emptyState,
  onOpen,
  onDismissReveal,
  onClearError,
  className = '',
}) => {
  const navigate = useNavigate();
  // The shop sells one pack today, so the panel opens the pack it is showing.
  const shownPack = packs[0] ?? null;
  const empty = EMPTY_STATES[emptyState];

  return (
    <Box className={`pack-opener ${className}`.trim()}>
      {error && (
        <Alert severity="error" className="pack-opener__alert" onClose={onClearError}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Box className="pack-opener__loading">
          <CircularProgress sx={{ color: '#4a9eff' }} />
        </Box>
      ) : totalPacks > 0 && shownPack ? (
        <Paper elevation={3} className="pack-inventory">
          <img className="pack-inventory__art" src={cardBackUrl()} alt="Card pack" />
          <Typography variant="h5" className="pack-inventory__title">
            {shownPack.name}
          </Typography>
          <Typography variant="body2" className="pack-inventory__caption">
            {`${shownPack.cardCount} random cards · ${totalPacks} waiting`}
          </Typography>

          <Button
            variant="contained"
            size="large"
            fullWidth
            className="pack-inventory__open"
            onClick={onOpen}
            disabled={isOpening || totalPacks === 0}
            startIcon={isOpening ? <CircularProgress size={18} color="inherit" /> : <RedeemIcon />}
          >
            {isOpening ? 'Opening…' : 'Open pack'}
          </Button>

          <Typography variant="body2" className="pack-inventory__hint">
            Opening a pack adds its cards to your collection right away.
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={3} className="pack-opener-empty">
          <Typography variant="h6" className="pack-opener-empty__title">
            {empty.title}
          </Typography>
          <Typography variant="body2" className="pack-opener-empty__caption">
            {empty.caption}
          </Typography>
          <Button
            variant="contained"
            size="large"
            className="pack-opener-empty__action"
            startIcon={empty.icon}
            onClick={() => navigate(empty.to)}
          >
            {empty.action}
          </Button>
        </Paper>
      )}

      <PackRevealModal open={isRevealing} cards={cards} onClose={onDismissReveal} />
    </Box>
  );
};
