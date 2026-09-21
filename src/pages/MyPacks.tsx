import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material';
import RedeemIcon from '@mui/icons-material/Redeem';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PackRevealModal } from '../components/PackRevealModal';
import { PlayerStats } from '../components/PlayerStats';
import { cardBackUrl } from '../data/CardArt';
import { apiService, type PackCard, type PackStack } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './MyPacks.scss';

/**
 * My Packs: the unopened packs the player holds, and the place where a pack is opened.
 *
 * Opening is a single call — the backend consumes the pack, draws the five cards and files them in the
 * collection, so the player owns the cards the moment the button returns. The reveal dialog that follows is
 * presentation only, which is why nothing here has to be re-fetched when its animation ends.
 */
export const MyPacks: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [packs, setPacks] = useState<PackStack[]>([]);
  const [cards, setCards] = useState<PackCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setPacks(await apiService.getPackInventory());
  }, []);

  // The inventory is the page's own source of truth; the profile is refreshed alongside it so every coin and
  // pack pill elsewhere stays in step.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const inventory = await apiService.getPackInventory();
        if (!cancelled) {
          setPacks(inventory);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    refreshUser();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const totalPacks = packs.reduce((total, pack) => total + pack.quantity, 0);
  // The shop sells one pack today, so the page opens the pack it is showing.
  const shownPack = packs[0] ?? null;

  const handleOpen = useCallback(async () => {
    setIsOpening(true);
    setError(null);

    try {
      const opened = await apiService.openPack(shownPack?.code);

      // The cards are already drawn, filed and owned; the dialog only replays them face-down, so this is the
      // whole of the "receive the cards" step.
      setCards(opened.cards);
      setIsRevealing(true);

      setPacks(current =>
        current
          .map(pack =>
            pack.code === opened.packCode ? { ...pack, quantity: opened.packsOwned } : pack
          )
          .filter(pack => pack.quantity > 0)
      );

      await refreshUser();
    } catch (openError) {
      setError((openError as Error).message);

      // A failed open means this page's count is stale (e.g. another tab opened the last pack).
      try {
        await loadInventory();
      } catch {
        // Ignore: the open error above is the message worth showing.
      }
    } finally {
      setIsOpening(false);
    }
  }, [loadInventory, refreshUser, shownPack?.code]);

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

          {error && (
            <Alert severity="error" className="my-packs-alert" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Box className="my-packs-loading">
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
                onClick={handleOpen}
                disabled={isOpening || totalPacks === 0}
                startIcon={
                  isOpening ? <CircularProgress size={18} color="inherit" /> : <RedeemIcon />
                }
              >
                {isOpening ? 'Opening…' : 'Open pack'}
              </Button>

              <Typography variant="body2" className="pack-inventory__hint">
                Opening a pack adds its cards to your collection right away.
              </Typography>
            </Paper>
          ) : (
            <Paper elevation={3} className="my-packs-empty">
              <Typography variant="h6" className="my-packs-empty__title">
                {"You don't have any packs yet"}
              </Typography>
              <Typography variant="body2" className="my-packs-empty__caption">
                Packs are how a collection starts — five random cards for 1,500 coins.
              </Typography>
              <Button
                variant="contained"
                size="large"
                className="my-packs-empty__buy"
                startIcon={<StorefrontIcon />}
                onClick={() => navigate('/shop')}
              >
                Go to the Card Shop
              </Button>
            </Paper>
          )}

          <Button
            variant="text"
            color="inherit"
            className="my-packs-back"
            onClick={() => navigate('/lobby')}
          >
            ← Back to Lobby
          </Button>
        </Box>
      </Container>

      <PackRevealModal open={isRevealing} cards={cards} onClose={() => setIsRevealing(false)} />
    </Box>
  );
};
