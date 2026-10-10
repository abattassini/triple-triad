import { Box, Button, Typography } from '@mui/material';
import { FiPlayCircle } from 'react-icons/fi';
import { BareModal } from './BareModal';
import { ALL_MATCH_RULES, type MatchRule } from '../services/api';
import { describeRules } from '../data/MatchRules';
import './MatchRulesModal.scss';

interface MatchRulesModalProps {
  open: boolean;
  /** The heading — "Quick Match" on Play, "Challenge <login>" when a friend is being invited. */
  title: string;
  /** Names the dialog for assistive tech. */
  ariaLabel: string;
  /** The choice, already in the caller's shape: `[]` for *Basic Match*, `ALL_MATCH_RULES` for *Match with Rules*. */
  onChoose: (rules: MatchRule[]) => void;
  onClose: () => void;
}

/**
 * The rule choice — *Basic Match* or *Match with Rules* — extracted from Play so the Quick Match flow and the friend
 * challenge offer the exact same thing (plans/PLAN-028-challenge-rules-and-friend-list/plan.md §3.3).
 *
 * It owns only the two options and their wording; what a choice *means* belongs to the caller, which is why it hands
 * back a rule list rather than calling anything itself. The *Match with Rules* caption is rendered from
 * `ALL_MATCH_RULES`, so a fifth rule needs no change here.
 */
export const MatchRulesModal: React.FC<MatchRulesModalProps> = ({
  open,
  title,
  ariaLabel,
  onChoose,
  onClose,
}) => (
  <BareModal
    open={open}
    onClose={onClose}
    // Full width up to the dialog's cap: without it MUI shrink-wraps the paper to its content, which left the modal a
    // narrow column in the middle of a desktop screen. The stylesheet keeps the content a modest centred column.
    fullWidth
    maxWidth="sm"
    className="match-rules-modal"
    ariaLabel={ariaLabel}
  >
    <Typography variant="h5" className="match-rules-modal__title">
      <FiPlayCircle className="page-title-icon" aria-hidden="true" />
      {title}
    </Typography>
    <Typography variant="body2" className="match-rules-modal__hint">
      Pick how you want to play
    </Typography>

    <Box className="match-rules-modal__options">
      <Button
        autoFocus
        variant="outlined"
        size="large"
        fullWidth
        className="match-rules-modal__option"
        onClick={() => onChoose([])}
      >
        <span className="match-rules-modal__option-label">Basic Match</span>
        <span className="match-rules-modal__option-caption">No special rules</span>
      </Button>

      <Button
        variant="contained"
        size="large"
        fullWidth
        className="match-rules-modal__option match-rules-modal__option--rules"
        onClick={() => onChoose(ALL_MATCH_RULES)}
      >
        <span className="match-rules-modal__option-label">Match with Rules</span>
        <span className="match-rules-modal__option-caption">{describeRules(ALL_MATCH_RULES)}</span>
      </Button>
    </Box>

    <Button variant="text" color="inherit" className="match-rules-modal__cancel" onClick={onClose}>
      Cancel
    </Button>
  </BareModal>
);
