import { Box, Container, Typography } from '@mui/material';
import { FiCreditCard, FiHome, FiShoppingCart } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ActionTile } from '../components/ActionTile';
import './Home.scss';

/**
 * Home: the collection-and-economy hub the chrome's Home entry opens.
 *
 * It offers the two things the request lists — **View Cards** (`/cards`) and **Buy Packs** (`/shop`) — as two
 * `ActionTile`s: the very panel Play's Quick Match tiles render, so the two pages' tiles cannot drift.
 */
export const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box className="home app-chrome-page">
      <Container className="home-container">
        <Box className="home-content">
          <Typography variant="h4" className="home-title">
            <FiHome className="page-title-icon" aria-hidden="true" /> Home
          </Typography>
          <Typography variant="body1" className="home-subtitle">
            Your collection and your packs, one tap away
          </Typography>

          <Box className="action-tiles">
            <ActionTile
              icon={<FiCreditCard />}
              title="View Cards"
              caption="See the cards you own, grouped by level"
              actionLabel="View Cards"
              onAction={() => navigate('/cards')}
            />

            <ActionTile
              icon={<FiShoppingCart />}
              title="Buy Packs"
              caption="Buy a 5-card pack for coins and open it in My Packs"
              actionLabel="Buy Packs"
              onAction={() => navigate('/shop')}
            />
          </Box>
        </Box>
      </Container>
    </Box>
  );
};
