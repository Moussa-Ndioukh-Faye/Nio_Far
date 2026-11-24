import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider } from "./contexts/GameContext";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { OfflineBanner, UpdatePrompt } from "./components/PwaPrompts";

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:code" element={<Room />} />
        </Routes>
        <UpdatePrompt />
      </BrowserRouter>
    </GameProvider>
  );
}
