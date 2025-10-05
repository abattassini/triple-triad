import { Box } from '@mui/material';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { Match as MatchComponent } from '../components/Match';

export const MatchPage: React.FC = () => {
  return (
    <Box>
      <HamburgerMenu />
      <MatchComponent />
    </Box>
  );
};
