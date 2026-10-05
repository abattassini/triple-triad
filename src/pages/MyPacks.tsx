import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { FiArrowLeft, FiGift } from 'react-icons/fi';
import { PackOpener } from '../components/PackOpener';
import { usePackInventory } from '../hooks/usePackInventory';
import './MyPacks.scss';

/**
 * My Packs: the unopened packs the player holds, and the place where a pack is opened.
 *
 * The panel, the opening call and the reveal all come from the shared `PackOpener` — the very same component the
 * Welcome page renders — so this page only contributes the page around it.
 */
export const MyPacks: React.FC = () => {
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
    <Box className="my-packs app-chrome-page">
      <Container maxWidth="lg" className="my-packs-container">
        <Box className="my-packs-content">
          <Typography variant="h4" className="my-packs-title">
            <FiGift className="page-title-icon" aria-hidden="true" /> My Packs
          </Typography>
          <Typography variant="body1" className="my-packs-subtitle">
            {isLoading
              ? 'Checking your packs…'
              : totalPacks > 0
                ? `You have ${totalPacks} ${totalPacks === 1 ? 'pack' : 'packs'} to open`
                : 'Packs you buy in the Card Shop wait here until you open them'}
          </Typography>

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
            onClick={() => navigate('/home')}
            startIcon={<FiArrowLeft />}
          >
            Back to Home
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
