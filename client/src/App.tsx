import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameProvider } from "./contexts/GameContext";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { OfflineBanner, UpdatePrompt } from "./components/PwaPrompts";
import { Backdrop } from "./components/Backdrop";
import { Splash } from "./components/Splash";

export default function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Backdrop />
        <Splash />
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
