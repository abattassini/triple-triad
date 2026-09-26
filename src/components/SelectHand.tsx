import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Typography,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RedeemIcon from '@mui/icons-material/Redeem';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { CardTile } from './CardTile';
import {
  CARD_LEVELS,
  HAND_SIZE,
  apiService,
  type CollectionSummary,
  type OwnedCard,
  type OwnedCardLevel,
} from '../services/api';
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

interface LevelRowProps {
  level: number;
  /** The cards of this level that are **still available**: a picked one is in a slot, not in this row (§3.10). */
  cards: OwnedCard[];
  /** True once five cards are picked: what is left in the row can no longer be taken. */
  isReady: boolean;
  onPick: (row: OwnedCard) => void;
}

/**
 * One level's available cards, as a **single row that scrolls sideways** — never two lines, whatever the shell's width
 * works out to (§3.7). It owns the three things that make the row read as scrollable: the edge scrim, the arrow button,
 * and the measurement both depend on. A scrim or an arrow is rendered only in a direction that can still scroll, so
 * neither ever sits there inert.
 *
 * Picking is what empties this row: the card goes to a slot and out of the level (§3.10), so the list it is handed
 * shrinks — which is why the affordances are measured again on every change of that list, not only on a resize.
 *
 * Not exported: this is the picker's private part, and `SelectHand` stays its one public component.
 */
const LevelRow: React.FC<LevelRowProps> = ({ level, cards, isReady, onPick }) => {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  // Read straight off the element: this is the one place that knows how much of the row is out of sight.
  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) {
      return;
    }

    // A pixel of tolerance, because a fractional scroll position never lands exactly on an end.
    const furthest = row.scrollWidth - row.clientWidth;
    setCanScroll({ left: row.scrollLeft > 1, right: row.scrollLeft < furthest - 1 });
  }, []);

  useEffect(() => {
    // The modal is this component's viewport, so a width change (a rotation, a desktop resize) remeasures the row.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // A pick shortens the row, and no scroll event fires for a list that changed under it: the scrims and the arrows have
  // to be re-read here, or a row that just became fully visible would keep an arrow pointing at nothing.
  useEffect(() => {
    measure();
  }, [measure, cards]);

  const scrollAcross = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) {
      return;
    }

    // Four fifths of what is on screen: a good mouthful of cards, with the one you were looking at still in view.
    row.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <Box className="select-hand__row">
      {canScroll.left && (
        <span className="select-hand__row-scrim select-hand__row-scrim--left" aria-hidden="true" />
      )}
      {canScroll.left && (
        <IconButton
          size="small"
          className="select-hand__row-arrow select-hand__row-arrow--left"
          aria-label={`Scroll back through the level ${level} cards`}
          onClick={() => scrollAcross(-1)}
        >
          <ChevronLeftIcon />
        </IconButton>
      )}

      <Box
        className="select-hand__grid"
        role="group"
        aria-label={`Level ${level} cards`}
        ref={rowRef}
        onScroll={measure}
      >
        {cards.map((card, index) => (
          <Box
            key={card.card.id}
            component="button"
            type="button"
            className={`select-hand__option${isReady ? ' select-hand__option--blocked' : ''}`}
            disabled={isReady}
            title={
              isReady ? 'Hand full — remove one to swap' : `Add ${card.card.name} to your hand`
            }
            onClick={() => onPick(card)}
          >
            <CardTile image={card.card.image} name={card.card.name} animationDelayMs={index * 20} />
          </Box>
        ))}
      </Box>

      {canScroll.right && (
        <span className="select-hand__row-scrim select-hand__row-scrim--right" aria-hidden="true" />
      )}
      {canScroll.right && (
        <IconButton
          size="small"
          className="select-hand__row-arrow select-hand__row-arrow--right"
          aria-label={`Scroll on through the level ${level} cards`}
          onClick={() => scrollAcross(1)}
        >
          <ChevronRightIcon />
        </IconButton>
      )}
    </Box>
  );
};

/**
 * The hand picker: **ten level accordions** — one per card level, all ten always listed — each holding the cards the
 * player still has **available** at that level, plus five slots that fill as they click. A level's own name, counts and
 * chevron ride **over** the top of its cards (§3.9), and the chevron is the level's only control. Picking moves a card
 * into a slot and **out** of its level, and a level with nothing left to show — one they own nothing in, or one whose
 * cards are all picked — is a single head with no chevron (§3.10). A card goes back by clicking its slot, which returns
 * it to its level and unfolds that level again; once five are in, what is left in the rows goes inert until one of them
 * comes back.
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
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [selected, setSelected] = useState<OwnedCard[]>([]);
  // Every level starts open. With all ten on screen the picker reads as one list of card rows and the player folds away
  // whatever they are not interested in — which is also why both opening requests go out together below, instead of one
  // level at a time the way a collapsed-only picker would.
  const [expandedLevels, setExpandedLevels] = useState<number[]>(CARD_LEVELS);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Opens the picker: the summary for the headers and the whole collection for the rows, one request each. */
  const load = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);

    Promise.all([apiService.getCollectionSummary(), apiService.getMyCards()])
      .then(([loadedSummary, loadedCards]) => {
        setSummary(loadedSummary);
        setCards(loadedCards);
      })
      .catch((loadError_: Error) => setLoadError(loadError_.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  const selectedIds = new Set(selected.map(row => row.card.id));
  // Highest level first: the strongest cards live up there, so that is where a player starts. An empty level is still a
  // real row rather than a level the picker pretends does not exist.
  const levels: OwnedCardLevel[] = [...CARD_LEVELS]
    .reverse()
    .map(
      level =>
        summary?.levels.find(row => row.level === level) ?? { level, ownedCount: 0, totalCount: 0 }
    );
  // One name-sorted bucket per level of the cards **still available** — a picked card belongs to a slot now, so it is
  // not in here (§3.10) — built once per render: ten lookups over a collection of a few hundred rows.
  const availableByLevel = new Map<number, OwnedCard[]>();
  cards.forEach(row => {
    if (selectedIds.has(row.card.id)) {
      return;
    }

    const level = row.card.level ?? 0;
    const bucket = availableByLevel.get(level);
    if (bucket) {
      bucket.push(row);
    } else {
      availableByLevel.set(level, [row]);
    }
  });
  availableByLevel.forEach(bucket =>
    bucket.sort((left, right) => left.card.name.localeCompare(right.card.name))
  );
  const ownedDistinct = summary?.distinctCards ?? 0;
  const missing = HAND_SIZE - selected.length;
  const canPlay = ownedDistinct >= HAND_SIZE;
  const isReady = selected.length === HAND_SIZE;

  /** Picking is one-way on the card itself: it leaves its row for a slot, and only the slot sends it back (§3.10). */
  const pick = (row: OwnedCard) =>
    setSelected(current => (current.length >= HAND_SIZE ? current : [...current, row]));

  const unpick = (cardId: number) =>
    setSelected(current => current.filter(row => row.card.id !== cardId));

  const handleLevelToggle = (level: number, isExpanded: boolean) => {
    setExpandedLevels(current =>
      isExpanded ? [...current, level] : current.filter(open => open !== level)
    );
  };

  return (
    <Box className={`select-hand ${className}`.trim()}>
      <Typography variant="h5" className="select-hand__title">
        Choose your hand
      </Typography>
      {/* The count is announced as it changes: with ten accordions the player is often scrolled away from the slots. */}
      <Typography variant="body2" className="select-hand__hint" role="status" aria-live="polite">
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
              aria-label={`Put ${row.card.name} back`}
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
        <Alert
          severity="error"
          className="select-hand__alert"
          action={
            <Button size="small" color="inherit" className="select-hand__retry" onClick={load}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}

      {isLoading ? (
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
        <Box className="select-hand__levels">
          {levels.map(row => {
            // A pick takes its card out of the row and into a slot (§3.10), so a level whose cards are all picked has
            // exactly as much to show as one the player owns nothing in: nothing.
            const available = availableByLevel.get(row.level) ?? [];
            const hasAvailable = available.length > 0;
            // `none owned` is about the collection, not about the screen: picking a card does not change ownership.
            const ownsNone = row.ownedCount === 0;
            const pickedHere = selected.filter(picked => picked.card.level === row.level).length;
            // Open while the player has it open **and** there is something to see: the last pick out of a level folds
            // it away, and returning that card unfolds it again. Nothing takes the level out of `expandedLevels`, so a
            // level the player was browsing comes back open instead of waiting to be reopened (§3.10).
            const isExpanded = hasAvailable && expandedLevels.includes(row.level);

            return (
              <Accordion
                key={row.level}
                className={`select-hand__level${hasAvailable ? '' : ' select-hand__level--empty'}`}
                // Expanded from the level's own state, and changed by **one** thing only: the chevron in the head below.
                // There is deliberately no `onChange` here, so a click that lands on the head's label — or on a card
                // behind it — can neither open nor close a level.
                //
                // A level with nothing to show is closed by this flag, and not by `disabled` the way it was before
                // §3.9: MUI passes a controlled `expanded` straight to its Collapse (`in: expanded`) and `disabled` only
                // ever stopped the *user*, so an empty level opened by the ten-level default rendered a card-less body
                // — measured as a 132px strip, the row's own `min-height`.
                expanded={isExpanded}
                disableGutters
              >
                {/* A plain overlay instead of MUI's `AccordionSummary`: that component's root *is* a button wired to
                    the accordion's own `toggle`, which is exactly "the whole header opens it". Being the accordion's
                    first child still earns the cards the `region` MUI wraps them in, labelled by this head's `id`. */}
                <Box className="select-hand__level-head" id={`select-hand-level-${row.level}`}>
                  {/* The head's one piece with a backdrop of its own (§3.10): the text keeps its pill, and the gaps
                      around it — and the rest of the head — still show the cards through. */}
                  <Box className="select-hand__level-text">
                    <Typography className="select-hand__level-title" component="span">
                      {`Level ${row.level}`}
                    </Typography>
                    <Typography
                      className="select-hand__level-count"
                      component="span"
                      variant="body2"
                    >
                      {ownsNone ? 'none owned' : `${row.ownedCount} of ${row.totalCount}`}
                    </Typography>
                    {pickedHere > 0 && (
                      <Typography
                        className="select-hand__level-picked"
                        component="span"
                        variant="body2"
                      >
                        {`· ${pickedHere} picked`}
                      </Typography>
                    )}
                  </Box>
                  {/* The level's only control. The head around it is `pointer-events: none` (§3.9), so the label is not
                      clickable and the cards the head covers still take their own clicks. A level with nothing left to
                      show has no chevron at all — there is nothing it could open (§3.10). */}
                  {hasAvailable && (
                    <IconButton
                      size="small"
                      className="select-hand__level-toggle"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} the level ${row.level} cards`}
                      aria-expanded={isExpanded}
                      onClick={() => handleLevelToggle(row.level, !isExpanded)}
                    >
                      <ExpandMoreIcon />
                    </IconButton>
                  )}
                </Box>

                <AccordionDetails className="select-hand__level-body">
                  <LevelRow level={row.level} cards={available} isReady={isReady} onPick={pick} />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
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
