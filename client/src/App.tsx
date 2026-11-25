import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { GameProvider } from "./contexts/GameContext";
import { Home } from "./pages/Home";
import { OfflineBanner, UpdatePrompt } from "./components/PwaPrompts";
import { Backdrop } from "./components/Backdrop";
import { Splash } from "./components/Splash";

// La salle de jeu n'est chargée qu'au besoin : accueil plus léger au premier affichage.
const Room = lazy(() => import("./pages/Room").then((m) => ({ default: m.Room })));
const Privacy = lazy(() => import("./pages/Privacy").then((m) => ({ default: m.Privacy })));

export default function App() {
  return (
    // reducedMotion="user" : Framer Motion coupe les animations si l'appareil le demande
    <MotionConfig reducedMotion="user">
    <GameProvider>
      <BrowserRouter>
        <Backdrop />
        <Splash />
        <OfflineBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/confidentialite"
            element={
              <Suspense fallback={null}>
                <Privacy />
              </Suspense>
            }
          />
          <Route
            path="/room/:code"
            element={
              <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sand" role="status">Chargement…</div>}>
                <Room />
              </Suspense>
            }
          />
        </Routes>
        <UpdatePrompt />
      </BrowserRouter>
    </GameProvider>
    </MotionConfig>
  );
}
