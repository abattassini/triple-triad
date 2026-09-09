import { Routes, Route } from 'react-router-dom';
import './App.css';
import { Landing } from './pages/Landing';
import { Lobby } from './pages/Lobby';
import { UsernameTaken } from './pages/UsernameTaken';
import { MatchPage } from './pages/MatchPage';
import { AccountCreation } from './pages/AccountCreation';
import { SignIn } from './pages/SignIn';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create-account" element={<AccountCreation />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/:username" element={<Lobby />} />
        <Route path="/lobby/:username" element={<Lobby />} />
        <Route path="/username-taken/:username" element={<UsernameTaken />} />
        <Route path="/match/:matchId/:username" element={<MatchPage />} />
      </Routes>
    </div>
  );
}

export default App;
