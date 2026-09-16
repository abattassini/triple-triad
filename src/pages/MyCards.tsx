import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { CardTile } from '../components/CardTile';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { PlayerStats } from '../components/PlayerStats';
import { apiService, type Card, type OwnedCard } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './MyCards.scss';

// One level of the collection: the cards of that level the player owns, and how much of the level that is.
interface LevelSection {
  level: number;
  cards: OwnedCard[];
  ownedCount: number;
  totalCount: number;
}

/**
 * My Cards: the cards the player owns, classified by card level (1 → 10). Only levels the player owns cards in
 * get a section, so the page grows with the collection; each section shows `owned of total` for that level and
 * duplicates are folded into a `×N` badge.
 *
 * Both the grouping and the totals are derived here: the collection endpoint returns a flat list and the public
 * catalogue (`getAllCards`) supplies how many cards exist per level.
 */
export const MyCards: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [owned, setOwned] = useState<OwnedCard[]>([]);
  const [catalogue, setCatalogue] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [myCards, allCards] = await Promise.all([
          apiService.getMyCards(),
          apiService.getAllCards(),
        ]);

        if (!cancelled) {
          setOwned(myCards);
          setCatalogue(allCards);
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

    return () => {
      cancelled = true;
    };
  }, []);

  // How many cards the catalogue holds per level, so a section can read "6 of 27".
  const levelTotals = useMemo(() => {
    const totals = new Map<number, number>();

    catalogue.forEach(card => {
      const level = card.level ?? 0;
      totals.set(level, (totals.get(level) ?? 0) + 1);
    });

    return totals;
  }, [catalogue]);

  // The collection grouped by level (ascending), each level's cards sorted by name.
  const sections = useMemo<LevelSection[]>(() => {
    const byLevel = new Map<number, OwnedCard[]>();

    owned.forEach(row => {
      const level = row.card.level ?? 0;
      const rows = byLevel.get(level) ?? [];
      rows.push(row);
      byLevel.set(level, rows);
    });

    return [...byLevel.entries()]
      .sort(([left], [right]) => left - right)
      .map(([level, rows]) => ({
        level,
        cards: [...rows].sort((left, right) => left.card.name.localeCompare(right.card.name)),
        ownedCount: rows.length,
        totalCount: levelTotals.get(level) ?? rows.length,
      }));
  }, [owned, levelTotals]);

  const distinctOwned = owned.length;
  const copiesOwned = owned.reduce((total, row) => total + row.quantity, 0);
  const hasCards = sections.length > 0;

  return (
    <Box className="my-cards">
      <HamburgerMenu />

      <Container maxWidth="lg" className="my-cards-container">
        <Box className="my-cards-content">
          <Typography variant="h4" className="my-cards-title">
            🃏 My Cards
          </Typography>
          <Typography variant="body1" className="my-cards-subtitle">
            {isLoading
              ? 'Loading your collection…'
              : hasCards
                ? `${distinctOwned} distinct cards · ${copiesOwned} copies owned`
                : 'Your collection is empty'}
          </Typography>

          <PlayerStats player={user} variant="card" className="my-cards-stats" />

          {error && (
            <Alert severity="error" className="my-cards-alert" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Box className="my-cards-loading">
              <CircularProgress sx={{ color: '#4a9eff' }} />
            </Box>
          ) : hasCards ? (
            <Box className="my-cards-levels">
              {sections.map(section => (
                <Paper key={section.level} elevation={3} className="level-section">
                  <Box className="level-section__header">
                    <span className="level-section__title">Level {section.level}</span>
                    <span className="level-section__count">
                      {section.ownedCount} of {section.totalCount}
                    </span>
                  </Box>

                  <Box className="level-section__cards">
                    {section.cards.map((row, index) => (
                      <CardTile
                        key={row.card.id}
                        image={row.card.image}
                        name={row.card.name}
                        level={row.card.level}
                        quantity={row.quantity > 1 ? row.quantity : undefined}
                        animationDelayMs={index * 40}
                      />
                    ))}
                  </Box>
                </Paper>
              ))}
            </Box>
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

          {hasCards && !isLoading && (
            <Button variant="outlined" className="my-cards-shop" onClick={() => navigate('/shop')}>
              Buy more cards
            </Button>
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
