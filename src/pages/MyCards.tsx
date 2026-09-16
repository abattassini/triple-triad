import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { CardTile } from '../components/CardTile';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PlayerStats } from '../components/PlayerStats';
import { apiService, type CollectionSummary, type OwnedCard } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './MyCards.scss';

/**
 * My Cards: the cards the player owns, classified by level and shown **one level at a time**.
 *
 * Only the per-level summary (a handful of counts) is loaded up front; the cards themselves are fetched when
 * the level picker changes, so the page never pulls the whole collection. Levels the player owns nothing in
 * are not offered, and the cards inside a level are listed by name.
 */
export const MyCards: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  // The per-level summary is all that is needed to land the page, on the lowest level the player owns.
  useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      try {
        const loaded = await apiService.getCollectionSummary();
        if (!cancelled) {
          setSummary(loaded);
          setSelectedLevel(loaded.levels[0]?.level ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSummary(false);
        }
      }
    };

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetches only the picked level, every time the picker changes.
  useEffect(() => {
    if (selectedLevel === null) {
      setCards([]);
      return;
    }

    let cancelled = false;
    setIsLoadingCards(true);

    apiService
      .getMyCards(selectedLevel)
      .then(rows => {
        if (!cancelled) {
          setCards([...rows].sort((left, right) => left.card.name.localeCompare(right.card.name)));
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCards(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLevel]);

  const levels = summary?.levels ?? [];
  const selected = levels.find(row => row.level === selectedLevel) ?? null;
  const hasCards = levels.length > 0;

  const handleLevelChange = (level: number) => {
    setError(null);
    setSelectedLevel(level);
  };

  return (
    <Box className="my-cards">
      <HamburgerMenu />

      <Container maxWidth={false} className="my-cards-container">
        <Box className="my-cards-content">
          <Typography variant="h4" className="my-cards-title">
            🃏 My Cards
          </Typography>
          <Typography variant="body1" className="my-cards-subtitle">
            {isLoadingSummary
              ? 'Loading your collection…'
              : hasCards
                ? `${summary?.distinctCards ?? 0} distinct cards · ${summary?.copiesOwned ?? 0} copies owned`
                : 'Your collection is empty'}
          </Typography>

          <PlayerStats player={user} variant="card" className="my-cards-stats" />

          {error && (
            <Alert severity="error" className="my-cards-alert" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isLoadingSummary ? (
            <Box className="my-cards-loading">
              <CircularProgress sx={{ color: '#4a9eff' }} />
            </Box>
          ) : hasCards ? (
            <>
              <Box className="my-cards-picker">
                <TextField
                  select
                  size="small"
                  label="Level"
                  className="my-cards-picker__select"
                  value={selectedLevel ?? ''}
                  disabled={isLoadingCards}
                  onChange={event => handleLevelChange(Number(event.target.value))}
                >
                  {levels.map(row => (
                    <MenuItem key={row.level} value={row.level}>
                      {`Level ${row.level} — ${row.ownedCount} of ${row.totalCount}`}
                    </MenuItem>
                  ))}
                </TextField>

                <Typography variant="body2" className="my-cards-picker__hint">
                  {isLoadingCards
                    ? 'Loading cards…'
                    : selected
                      ? `Showing the ${selected.ownedCount} cards you own at level ${selected.level}`
                      : ''}
                </Typography>
              </Box>

              <Paper elevation={3} className="level-section">
                {isLoadingCards ? (
                  <Box className="level-section__loading">
                    <CircularProgress size={28} sx={{ color: '#4a9eff' }} />
                  </Box>
                ) : (
                  <Box className="level-section__cards">
                    {cards.map((row, index) => (
                      <CardTile
                        key={row.card.id}
                        image={row.card.image}
                        name={row.card.name}
                        quantity={row.quantity > 1 ? row.quantity : undefined}
                        animationDelayMs={index * 30}
                      />
                    ))}
                  </Box>
                )}
              </Paper>

              <Button
                variant="outlined"
                className="my-cards-shop"
                onClick={() => navigate('/shop')}
              >
                Buy more cards
              </Button>
            </>
          ) : (
            <Paper elevation={3} className="my-cards-empty">
              <Typography variant="h6" className="my-cards-empty__title">
                {"You don't own any cards yet"}
              </Typography>
              <Typography variant="body2" className="my-cards-empty__caption">
                Packs are how a collection starts — five random cards for 1,500 coins.
              </Typography>
              <Button
                variant="contained"
                size="large"
                className="my-cards-empty__buy"
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
            className="my-cards-back"
            onClick={() => navigate('/lobby')}
          >
            ← Back to Lobby
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
