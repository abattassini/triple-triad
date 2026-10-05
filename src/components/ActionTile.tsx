import { Box, Button, Paper, Typography } from '@mui/material';
import './ActionTile.scss';

interface ActionTileProps {
  /** The tile's icon — a `react-icons` one, where an emoji used to be. */
  icon: React.ReactNode;
  title: string;
  caption: string;
  /** The tile's primary action: the component renders it as the tile's own button, so a page passes no button markup. */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /** A body that is a whole state rather than the primary action (Play's searching panel). Takes precedence. */
  children?: React.ReactNode;
}

/**
 * One "section action" panel: a titled, captioned tile whose body is its action. Home (View Cards / Buy Packs) and
 * Play (Quick Match / CPU) both render it, which is what keeps the two screens' tiles identical — the PLAN-021 review
 * asked for exactly that.
 *
 * The component owns the whole tile **including its button**: a page passes the action's label and handler, never
 * button markup, so the tile's layout and styling live here (`ActionTile.scss`) rather than on the pages. The tiles
 * stack one per row at every width.
 */
export const ActionTile: React.FC<ActionTileProps> = ({
  icon,
  title,
  caption,
  actionLabel,
  onAction,
  actionDisabled,
  children,
}) => (
  <Paper elevation={3} className="action-tile">
    <Box className="action-tile__head">
      <span className="action-tile__icon" aria-hidden="true">
        {icon}
      </span>
      <Typography variant="h5" className="action-tile__title">
        {title}
      </Typography>
    </Box>
    <Typography variant="body2" className="action-tile__caption">
      {caption}
    </Typography>
    <Box className="action-tile__body">
      {children ??
        (actionLabel ? (
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null)}
    </Box>
  </Paper>
);
