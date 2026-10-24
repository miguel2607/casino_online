import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Cat from './components/Cat.jsx';
import Login from './pages/Login.jsx';
import Lobby from './pages/Lobby.jsx';
import History from './pages/History.jsx';
import Rewards from './pages/Rewards.jsx';
import Admin from './pages/Admin.jsx';
import Couple from './pages/Couple.jsx';
import Match from './pages/Match.jsx';
import Blackjack from './games/Blackjack.jsx';
import Roulette from './games/Roulette.jsx';
import Solitaire from './games/Solitaire.jsx';
import CatRace from './games/CatRace.jsx';
import Slots from './games/Slots.jsx';
import HiLo from './games/HiLo.jsx';
import FindTheCat from './games/FindTheCat.jsx';
import Scratch from './games/Scratch.jsx';
import Game2048 from './games/skill/Game2048.jsx';
import Minesweeper from './games/skill/Minesweeper.jsx';
import Wordle from './games/skill/Wordle.jsx';
import Sudoku from './games/skill/Sudoku.jsx';
import Simon from './games/skill/Simon.jsx';
import { FlappyPage, KartPage, SprintPage } from './games/skill/Arcade.jsx';

function Splash() {
  return (
    <div className="splash">
      <Cat mood="sleepy" size={96} />
      <p>Despertando a los michis…</p>
    </div>
  );
}

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <Splash /> : user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Lobby />} />
        <Route path="pareja" element={<Couple />} />
        <Route path="pareja/partida/:id" element={<Match />} />
        <Route path="historial" element={<History />} />
        <Route path="recompensas" element={<Rewards />} />
        <Route
          path="admin"
          element={
            <Protected admin>
              <Admin />
            </Protected>
          }
        />
        <Route path="juego/blackjack" element={<Blackjack />} />
        <Route path="juego/ruleta" element={<Roulette />} />
        <Route path="juego/solitario" element={<Solitaire />} />
        <Route path="juego/carrera" element={<CatRace />} />
        <Route path="juego/tragamonedas" element={<Slots />} />
        <Route path="juego/mayor-menor" element={<HiLo />} />
        <Route path="juego/encuentra-al-michi" element={<FindTheCat />} />
        <Route path="juego/rasca-y-gana" element={<Scratch />} />
        <Route path="juego/2048" element={<Game2048 />} />
        <Route path="juego/buscaminas" element={<Minesweeper />} />
        <Route path="juego/wordle" element={<Wordle />} />
        <Route path="juego/sudoku" element={<Sudoku />} />
        <Route path="juego/simon" element={<Simon />} />
        <Route path="juego/flappy" element={<FlappyPage />} />
        <Route path="juego/kart" element={<KartPage />} />
        <Route path="juego/sprint" element={<SprintPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
