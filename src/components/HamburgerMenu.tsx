import { useState } from 'react';
import {
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate, useParams } from 'react-router-dom';
import './HamburgerMenu.scss';

export const HamburgerMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const menuItems = [
    { text: 'Lobby', icon: <HomeIcon />, path: `/lobby/${username}` },
    { text: 'Active Matches', icon: <SportsEsportsIcon />, path: `/matches/${username}` },
    { text: 'Rules', icon: <HelpOutlineIcon />, path: `/rules` },
  ];

  return (
    <>
      <IconButton
        onClick={toggleDrawer(true)}
        sx={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1300,
          color: '#fff',
          backgroundColor: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(10px)',
          '&:hover': {
            backgroundColor: 'rgba(74, 158, 255, 0.2)',
          },
        }}
      >
        <MenuIcon />
      </IconButton>

      <Drawer
        anchor="left"
        open={open}
        onClose={toggleDrawer(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
          },
        }}
      >
        <Box className="menu-container" onClick={toggleDrawer(false)}>
          {/* Header */}
          <Box className="menu-header">
            <Typography variant="h5" className="menu-title">
              Triple Triad
            </Typography>
            {username && (
              <Box className="user-info">
                <PersonIcon fontSize="small" />
                <Typography variant="body2" className="username">
                  Playing as: {username}
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ borderColor: '#3a3a5e' }} />

          {/* Menu Items */}
          <List>
            {menuItems.map(item => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton onClick={() => handleNavigation(item.path)}>
                  <ListItemIcon sx={{ color: '#4a9eff', minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  );
};
