import { Box } from '@mui/material';
import { cardArtUrl } from '../data/CardArt';
import './CardTile.scss';

interface CardTileProps {
  /** Catalogue-relative art path, e.g. `ff8-deck/squall.jpg`. */
  image: string;
  name: string;
  /** Drawn as the `Lv N` badge when provided. */
  level?: number;
  /** Drawn as a `×N` badge when provided. */
  quantity?: number;
  /** Replaces the quantity badge with `NEW` (this card was the player's first copy). */
  isNew?: boolean;
  /** Staggered entrance delay in milliseconds; the tile always uses the shared reveal animation. */
  animationDelayMs?: number;
  className?: string;
}

/**
 * One card, as shown in the Card Shop's pack reveal and in the My Cards collection: art, name, level and an
 * optional `NEW` / `×N` badge.
 */
export const CardTile: React.FC<CardTileProps> = ({
  image,
  name,
  level,
  quantity,
  isNew,
  animationDelayMs,
  className = '',
}) => {
  const badge = isNew ? 'NEW' : quantity !== undefined ? `×${quantity}` : null;

  return (
    <Box
      className={`card-tile ${className}`.trim()}
      style={
        animationDelayMs === undefined ? undefined : { animationDelay: `${animationDelayMs}ms` }
      }
    >
      <img className="card-tile__art" src={cardArtUrl(image)} alt={name} />
      <span className="card-tile__name">{name}</span>
      <span className="card-tile__meta">
        {level !== undefined && <span className="card-tile__level">Lv {level}</span>}
        {badge && (
          <span className={isNew ? 'card-tile__badge card-tile__badge--new' : 'card-tile__badge'}>
            {badge}
          </span>
        )}
      </span>
    </Box>
  );
};
