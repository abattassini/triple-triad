import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PackOpener } from '../components/PackOpener';
import { PlayerStats } from '../components/PlayerStats';
import { usePackInventory } from '../hooks/usePackInventory';
import { useAuth } from '../contexts/AuthContext';
import './MyPacks.scss';

/**
 * My Packs: the unopened packs the player holds, and the place where a pack is opened.
 *
 * The panel, the opening call and the reveal all come from the shared `PackOpener` — the very same component the
 * Welcome page renders — so this page only contributes the page around it.
 */
export const MyPacks: React.FC = () => {
  const { user } = useAuth();
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
    <Box className="my-packs">
      <HamburgerMenu />

      <Container maxWidth="lg" className="my-packs-container">
        <Box className="my-packs-content">
          <Typography variant="h4" className="my-packs-title">
            🎁 My Packs
          </Typography>
          <Typography variant="body1" className="my-packs-subtitle">
            {isLoading
              ? 'Checking your packs…'
              : totalPacks > 0
                ? `You have ${totalPacks} ${totalPacks === 1 ? 'pack' : 'packs'} to open`
                : 'Packs you buy in the Card Shop wait here until you open them'}
          </Typography>

          <PlayerStats player={user} variant="card" className="my-packs-stats" />

          <PackOpener
            packs={packs}
            totalPacks={totalPacks}
            cards={cards}
            isRevealing={isRevealing}
            isLoading={isLoading}
            isOpening={isOpening}
            error={error}
            emptyState="shop"
            onOpen={openPack}
            onDismissReveal={dismissReveal}
            onClearError={clearError}
          />

          <Button
            variant="text"
            color="inherit"
            className="my-packs-back"
            onClick={() => navigate('/lobby')}
          >
            {'← Back to Lobby'}
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
