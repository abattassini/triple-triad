import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import RedeemIcon from '@mui/icons-material/Redeem';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { CardTile } from './CardTile';
import { HAND_SIZE, apiService, type CollectionSummary, type OwnedCard } from '../services/api';
import './SelectHand.scss';

interface SelectHandProps {
  /** Fires with the picked ids — exactly HAND_SIZE of them — when the player confirms. */
  onConfirm: (cardIds: number[]) => void;
  /** True while the confirm call is in flight: Continue spins and cannot be pressed again. */
  isConfirming?: boolean;
  /** Message to show above the grid, e.g. the server rejecting the list. */
  error?: string | null;
  /** Rendered only when provided — the picker own way out. */
  onCancel?: () => void;
  className?: string;
}

/**
 * The hand picker: a level dropdown like My Cards, the cards the player owns at that level, and five slots that fill
 * as they click. Clicking a card in the grid moves it up; clicking it up there sends it back down.
 *
 * It owns browsing and selection only. Committing the hand (and the modal around it, if any) belongs to the caller,
 * which is what lets the same picker be dropped onto a page later without changing anything here.
 */
export const SelectHand: React.FC<SelectHandProps> = ({
  onConfirm,
  isConfirming = false,
  error = null,
  onCancel,
  className = '',
}) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  // The per-level summary is all that is needed to land the picker, on the lowest level the player owns.
  useEffect(() => {
    let cancelled = false;

    apiService
      .getCollectionSummary()
      .then(loaded => {
        if (!cancelled) {
          setSummary(loaded);
          setSelectedLevel(loaded.levels[0]?.level ?? null);
        }
      })
      .catch((loadError_: Error) => {
        if (!cancelled) {
          setLoadError(loadError_.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSummary(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // One level at a time, exactly like My Cards.
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
      .catch((loadError_: Error) => {
        if (!cancelled) {
          setLoadError(loadError_.message);
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

  const selectedIds = new Set(selected.map(row => row.card.id));
  const available = cards.filter(row => !selectedIds.has(row.card.id));
  const levels = summary?.levels ?? [];
  const ownedDistinct = summary?.distinctCards ?? 0;
  const missing = HAND_SIZE - selected.length;
  const canPlay = ownedDistinct >= HAND_SIZE;
  const isReady = selected.length === HAND_SIZE;

  const pick = (row: OwnedCard) =>
    setSelected(current => (current.length >= HAND_SIZE ? current : [...current, row]));

  const unpick = (cardId: number) =>
    setSelected(current => current.filter(row => row.card.id !== cardId));

  return (
    <Box className={`select-hand ${className}`.trim()}>
      <Typography variant="h5" className="select-hand__title">
        Choose your hand
      </Typography>
      <Typography variant="body2" className="select-hand__hint">
        {isReady
          ? 'All five cards are in — continue when you are ready.'
          : `Pick ${missing} more ${missing === 1 ? 'card' : 'cards'} for this match.`}
      </Typography>

      <Box className="select-hand__slots">
        {Array.from({ length: HAND_SIZE }).map((_, index) => {
          const row = selected[index];

          return row ? (
            <Box
              key={row.card.id}
              component="button"
              type="button"
              className="select-hand__slot select-hand__slot--filled"
              title="Put this card back"
              onClick={() => unpick(row.card.id)}
            >
              <CardTile image={row.card.image} name={row.card.name} />
            </Box>
          ) : (
            <Box
              key={`empty-${index}`}
              className="select-hand__slot select-hand__slot--empty"
              aria-hidden="true"
            >
              {index + 1}
            </Box>
          );
        })}
      </Box>

      {error && (
        <Alert severity="error" className="select-hand__alert">
          {error}
        </Alert>
      )}
      {loadError && (
        <Alert severity="error" className="select-hand__alert">
          {loadError}
        </Alert>
      )}

      {isLoadingSummary ? (
        <Box className="select-hand__loading">
          <CircularProgress sx={{ color: '#4a9eff' }} />
        </Box>
      ) : !canPlay ? (
        <Box className="select-hand__blocked">
          <Typography variant="h6" className="select-hand__blocked-title">
            {`You need ${HAND_SIZE} cards to play`}
          </Typography>
          <Typography variant="body2" className="select-hand__blocked-caption">
            {`You own ${ownedDistinct} — open a pack or buy one to add more cards to your collection.`}
          </Typography>
          <Box className="select-hand__blocked-actions">
            <Button
              variant="contained"
              className="select-hand__blocked-button"
              startIcon={<RedeemIcon />}
              onClick={() => navigate('/packs')}
            >
              Open my packs
            </Button>
            <Button
              variant="outlined"
              className="select-hand__blocked-button"
              startIcon={<StorefrontIcon />}
              onClick={() => navigate('/shop')}
            >
              Card Shop
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Box className="select-hand__picker">
            <TextField
              select
              size="small"
              label="Level"
              className="select-hand__picker-select"
              value={selectedLevel ?? ''}
              disabled={isLoadingCards}
              onChange={event => setSelectedLevel(Number(event.target.value))}
            >
              {levels.map(row => (
                <MenuItem key={row.level} value={row.level}>
                  {`Level ${row.level} — ${row.ownedCount} of ${row.totalCount}`}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="body2" className="select-hand__picker-hint">
              {isLoadingCards
                ? 'Loading cards…'
                : `${available.length} card${available.length === 1 ? '' : 's'} left to pick at this level`}
            </Typography>
          </Box>

          <Box className="select-hand__grid">
            {isLoadingCards ? (
              <Box className="select-hand__loading">
                <CircularProgress size={28} sx={{ color: '#4a9eff' }} />
              </Box>
            ) : (
              available.map((row, index) => (
                <Box
                  key={row.card.id}
                  component="button"
                  type="button"
                  className="select-hand__option"
                  title={`Add ${row.card.name} to your hand`}
                  onClick={() => pick(row)}
                >
                  <CardTile
                    image={row.card.image}
                    name={row.card.name}
                    animationDelayMs={index * 20}
                  />
                </Box>
              ))
            )}
          </Box>
        </>
      )}

      <Box className="select-hand__footer">
        {isReady && (
          <Button
            variant="contained"
            size="large"
            className="select-hand__continue"
            disabled={isConfirming}
            startIcon={isConfirming ? <CircularProgress size={18} color="inherit" /> : undefined}
            onClick={() => onConfirm(selected.map(row => row.card.id))}
          >
            {isConfirming ? 'Starting…' : 'Continue'}
          </Button>
        )}
        {onCancel && (
          <Button variant="text" color="inherit" className="select-hand__cancel" onClick={onCancel}>
            {'← Back to the Lobby'}
          </Button>
        )}
      </Box>
    </Box>
  );
};
