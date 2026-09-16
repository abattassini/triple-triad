import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PlayerStats } from '../components/PlayerStats';
import { apiService, type PackCard, type PackOffer } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './CardShop.scss';

// Card art is served from the frontend's public folder (Vite base is `/triple-triad/`).
const cardArtUrl = (image: string) => `/triple-triad/images/cards/${image}`;

// The pack itself is drawn with the seeded deck's card back.
const PACK_ART = cardArtUrl('ff8-deck/back.png');

/**
 * Card Shop: buy a pack of five cards for coins and see them opened. The price and pack size come from the
 * backend (`GET /api/shop/pack`) so the page can never disagree with what a purchase does; the level odds
 * the same endpoint reports are deliberately not shown here.
 */
export const CardShop: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [offer, setOffer] = useState<PackOffer | null>(null);
  const [opened, setOpened] = useState<PackCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadOffer = async () => {
      try {
        const packOffer = await apiService.getPackOffer();
        if (!cancelled) {
          setOffer(packOffer);
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
    setOpened(null);

    try {
      const purchase = await apiService.buyPack();
      setOpened(purchase.cards);
      // The wallet lives in the auth context, so re-read the profile to refresh every coin pill.
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
              ? `${offer.cardCount} random cards for ${offer.price.toLocaleString()} coins`
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
              <img className="pack-card__art" src={PACK_ART} alt="Card pack" />
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

          {opened && (
            <Paper elevation={3} className="pack-reveal">
              <Typography variant="h6" className="pack-reveal__title">
                You unpacked {opened.length} cards
              </Typography>

              <Box className="pack-reveal__cards">
                {opened.map((card, index) => (
                  <Box
                    key={`${card.id}-${index}`}
                    className="pack-reveal__card"
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <img
                      className="pack-reveal__art"
                      src={cardArtUrl(card.image)}
                      alt={card.name}
                    />
                    <span className="pack-reveal__name">{card.name}</span>
                    <span className="pack-reveal__meta">
                      <span className="pack-reveal__level">Lv {card.level ?? '?'}</span>
                      <span
                        className={
                          card.isNew
                            ? 'pack-reveal__badge pack-reveal__badge--new'
                            : 'pack-reveal__badge'
                        }
                      >
                        {card.isNew ? 'NEW' : `×${card.quantityOwned}`}
                      </span>
                    </span>
                  </Box>
                ))}
              </Box>

              <Button
                variant="outlined"
                className="pack-reveal__again"
                onClick={handleBuy}
                disabled={!canAfford || isBuying}
              >
                Buy another pack
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
