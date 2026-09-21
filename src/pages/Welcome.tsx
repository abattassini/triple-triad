import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { PackOpener } from '../components/PackOpener';
import { usePackInventory } from '../hooks/usePackInventory';
import './Welcome.scss';

/**
 * Welcome: where a player who has just created an account lands.
 *
 * The page says what the new account was given — no cards at all, and six packs of cards to start the game — and
 * then hands the player the pack panel straight away, so the first thing they do is open one. That panel is the
 * shared `PackOpener`, the very component My Packs renders, so both pages open packs in exactly the same way.
 *
 * It deliberately renders no `PlayerStats` and mounts no hamburger menu (the drawer header carries the compact
 * stats, so adding it here would put stats on this page too). Nothing links to the route either: it is the
 * one-shot onboarding step of a brand-new account, and the packs stay reachable through the 🎁 pill afterwards.
 */
export const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const {
    packs,
    totalPacks,
    cards,
    isRevealing,
    isLoading,
    isOpening,
    error,
    openPack,
    dismissReveal,
    clearError,
  } = usePackInventory();

  return (
    <Box className="welcome">
      <Container maxWidth="lg" className="welcome-container">
        <Box className="welcome-content">
          <Typography variant="h3" className="welcome-title">
            🎉 Welcome to Triple Triad
          </Typography>
          <Typography variant="h5" className="welcome-lead">
            You received 6 packs of cards to start the game
          </Typography>
          <Typography variant="body1" className="welcome-subtitle">
            Your account holds no cards yet — every pack holds five random cards, and they are added
            to your collection the moment you open one. Open them right here to build your first
            deck.
          </Typography>

          <PackOpener
            packs={packs}
            totalPacks={totalPacks}
            cards={cards}
            isRevealing={isRevealing}
            isLoading={isLoading}
            isOpening={isOpening}
            error={error}
            emptyState="lobby"
            onOpen={openPack}
            onDismissReveal={dismissReveal}
            onClearError={clearError}
          />

          <Button
            variant="text"
            color="inherit"
            className="welcome-back"
            onClick={() => navigate('/lobby')}
          >
            {'← Continue to the Lobby'}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
