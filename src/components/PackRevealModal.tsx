import { useEffect, useState } from 'react';
import { Box, Button, Dialog, Fade, Typography } from '@mui/material';
import { cardArtUrl, cardBackUrl } from '../data/CardArt';
import type { PackCard } from '../services/api';
import './PackRevealModal.scss';

interface PackRevealModalProps {
  open: boolean;
  /** The five cards the pack already granted — this component never fetches anything. */
  cards: PackCard[];
  /** Called by the Continue button, once every card has been revealed. */
  onClose: () => void;
}

/**
 * The pack reveal. The page dims like a regular modal, but the dialog itself has no surface — five face-down
 * cards float on the darkened page. Clicking one flips it in 3-D with a burst of light; the Continue button
 * appears at the bottom of the dialog only once every card is face up.
 *
 * The component is deliberately dumb: the cards arrive already drawn, filed and owned, so this animation can
 * never affect what the player actually got.
 */
export const PackRevealModal: React.FC<PackRevealModalProps> = ({ open, cards, onClose }) => {
  const [revealed, setRevealed] = useState<boolean[]>([]);

  // A new pack starts face-down again. Keyed on what the cards *are*, so a re-render of the page cannot reset a
  // half-finished reveal.
  const cardCount = cards.length;
  const cardsKey = cards.map(card => `${card.id}:${card.quantityOwned}`).join('|');

  useEffect(() => {
    if (open) {
      setRevealed(Array.from({ length: cardCount }, () => false));
    }
  }, [open, cardsKey, cardCount]);

  const revealedCount = revealed.filter(Boolean).length;
  const allRevealed = cardCount > 0 && revealedCount === cardCount;

  const reveal = (index: number) => {
    setRevealed(current =>
      current[index] ? current : current.map((value, i) => (i === index ? true : value))
    );
  };

  return (
    <Dialog
      open={open}
      maxWidth="lg"
      fullWidth
      slots={{ transition: Fade }}
      // Esc and the backdrop only close the dialog once nothing is left face-down, so a stray click cannot skip
      // the reveal; until then the Continue button is the way out.
      onClose={(_event, reason) => {
        if (allRevealed && (reason === 'escapeKeyDown' || reason === 'backdropClick')) {
          onClose();
        }
      }}
      slotProps={{
        // No surface at all: the cards and their light are the whole dialog.
        paper: {
          elevation: 0,
          className: 'pack-reveal-dialog__paper',
          sx: {
            background: 'none',
            boxShadow: 'none',
            border: 0,
            overflow: 'visible',
            margin: 0,
          },
        },
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(2px)',
          },
        },
      }}
    >
      <Box className="pack-reveal-dialog">
        <Typography variant="h5" className="pack-reveal-dialog__title">
          {allRevealed ? 'Pack opened!' : 'Open your pack'}
        </Typography>
        <Typography variant="body2" className="pack-reveal-dialog__hint">
          {allRevealed
            ? `All ${cardCount} cards were added to your collection.`
            : `Click a card to reveal it — ${revealedCount} of ${cardCount} revealed`}
        </Typography>

        <Box className="pack-reveal-dialog__cards">
          {cards.map((card, index) => {
            const isFlipped = Boolean(revealed[index]);

            return (
              <Box
                key={`${card.id}-${index}`}
                component="button"
                type="button"
                className={`pack-reveal-card${isFlipped ? ' pack-reveal-card--flipped' : ''}`}
                style={{ animationDelay: `${index * 90}ms` }}
                onClick={() => reveal(index)}
                aria-label={isFlipped ? card.name : `Reveal card ${index + 1}`}
              >
                {/* Behind the card, outside the 3-D element, so the burst stays flat while the card turns. */}
                <span className="pack-reveal-card__glow" aria-hidden="true" />

                <span className="pack-reveal-card__inner">
                  <span className="pack-reveal-card__face pack-reveal-card__face--back">
                    <img src={cardBackUrl()} alt="" />
                  </span>

                  <span className="pack-reveal-card__face pack-reveal-card__face--front">
                    <img src={cardArtUrl(card.image)} alt={card.name} />
                    <span className="pack-reveal-card__shine" aria-hidden="true" />
                    <span className="pack-reveal-card__caption">
                      <span className="pack-reveal-card__name">{card.name}</span>
                      <span className="pack-reveal-card__meta">
                        {card.level !== undefined && (
                          <span className="pack-reveal-card__level">Lv {card.level}</span>
                        )}
                        <span
                          className={
                            card.isNew
                              ? 'pack-reveal-card__badge pack-reveal-card__badge--new'
                              : 'pack-reveal-card__badge'
                          }
                        >
                          {card.isNew ? 'NEW' : `×${card.quantityOwned}`}
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
              </Box>
            );
          })}
        </Box>

        {allRevealed && (
          <Box className="pack-reveal-dialog__footer">
            <Button
              variant="contained"
              size="large"
              autoFocus
              className="pack-reveal-dialog__continue"
              onClick={onClose}
            >
              Continue
            </Button>
          </Box>
        )}
      </Box>
    </Dialog>
  );
};
