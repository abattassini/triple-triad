import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import RedeemIcon from '@mui/icons-material/Redeem';
import { cardBackUrl } from '../data/CardArt';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PlayerStats } from '../components/PlayerStats';
import { apiService, type PackOffer } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './CardShop.scss';

/**
 * Card Shop: buy a pack of five cards for coins. A purchase puts the **pack** in the player's inventory — the
 * cards are drawn and filed when it is opened on **My Packs**, so this page has no reveal of its own. The price
 * and pack size come from the backend (`GET /api/shop/pack`) so the page can never disagree with what a purchase
 * does; the level odds the same endpoint reports are deliberately not shown here.
 */
export const CardShop: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<PackOffer | null>(null);
  // How many unopened packs the player has: read from the offer on load, then kept in step by the purchases.
  const [packsOwned, setPacksOwned] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOffer = async () => {
      try {
        const packOffer = await apiService.getPackOffer();
        if (!cancelled) {
          setOffer(packOffer);
          setPacksOwned(packOffer.packsOwned);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
        }
      }
    };

    loadOffer();

    return () => {
      cancelled = true;
    };
  }, []);

  const coins = user?.coins ?? 0;
  const canAfford = offer !== null && coins >= offer.price;

  const handleBuy = useCallback(async () => {
    setIsBuying(true);
    setError(null);

    try {
      const purchase = await apiService.buyPack();
      setPacksOwned(purchase.packsOwned);
      // The wallet lives in the auth context, so re-read the profile to refresh every coin/pack pill.
      await refreshUser();
    } catch (buyError) {
      setError((buyError as Error).message);
    } finally {
      setIsBuying(false);
    }
  }, [refreshUser]);

  return (
    <Box className="card-shop">
      <HamburgerMenu />

      <Container maxWidth="lg" className="card-shop-container">
        <Box className="card-shop-content">
          <Typography variant="h4" className="card-shop-title">
            🛒 Card Shop
          </Typography>
          <Typography variant="body1" className="card-shop-subtitle">
            {offer
              ? `${offer.cardCount} random cards for ${offer.price.toLocaleString()} coins — the pack lands in My Packs, open it whenever you like`
              : 'Loading the pack…'}
          </Typography>

          <PlayerStats player={user} variant="card" className="card-shop-stats" />

          {error && (
            <Alert severity="error" className="card-shop-alert" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box className="card-shop-pack">
            <Paper elevation={3} className="pack-card">
              <img className="pack-card__art" src={cardBackUrl()} alt="Card pack" />
              <Typography variant="h5" className="pack-card__title">
                Card Pack
              </Typography>
              <Typography variant="body2" className="pack-card__caption">
                {offer ? `${offer.cardCount} random cards` : 'Loading…'}
              </Typography>

              <Button
                variant="contained"
                size="large"
                fullWidth
                className="pack-card__buy"
                onClick={handleBuy}
                disabled={offer === null || !canAfford || isBuying}
                startIcon={
                  isBuying ? <CircularProgress size={18} color="inherit" /> : <ShoppingBagIcon />
                }
              >
                {offer ? `Buy for ${offer.price.toLocaleString()} 🪙` : 'Loading…'}
              </Button>

              {offer && !canAfford && !isBuying && (
                <Typography variant="body2" className="pack-card__hint">
                  You need {(offer.price - coins).toLocaleString()} more coins — win matches to earn
                  them.
                </Typography>
              )}
            </Paper>
          </Box>

          {packsOwned > 0 && (
            <Paper elevation={3} className="pack-wallet">
              <Typography variant="h6" className="pack-wallet__title">
                {packsOwned === 1 ? '1 pack waiting' : `${packsOwned} packs waiting`}
              </Typography>

              <Typography variant="body2" className="pack-wallet__caption">
                The cards are drawn when you open the pack — every pack holds{' '}
                {offer?.cardCount ?? 5}.
              </Typography>

              <Button
                variant="contained"
                size="large"
                className="pack-wallet__open"
                startIcon={<RedeemIcon />}
                onClick={() => navigate('/packs')}
              >
                Open my packs
              </Button>

              <Button
                variant="text"
                color="inherit"
                className="pack-wallet__link"
                onClick={() => navigate('/cards')}
              >
                View my cards
              </Button>
            </Paper>
          )}

          <Button
            variant="text"
            color="inherit"
            className="card-shop-back"
            onClick={() => navigate('/lobby')}
          >
            ← Back to Lobby
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
