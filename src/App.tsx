import { Routes, Route } from 'react-router-dom';
import './App.css';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { UsernameTaken } from './pages/UsernameTaken';
import { MatchPage } from './pages/MatchPage';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/:username" element={<Lobby />} />
        <Route path="/lobby/:username" element={<Lobby />} />
        <Route path="/username-taken/:username" element={<UsernameTaken />} />
        <Route path="/match/:matchId/:username" element={<MatchPage />} />
      </Routes>
    </div>
  );
}

export default App;
