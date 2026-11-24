import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";

/** Toast « nouvelle version » : on ne recharge jamais de force (partie en cours). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // vérifie les mises à jour toutes les heures si l'app reste ouverte
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  return (
    <AnimatePresence>
      {(needRefresh || offlineReady) && (
        <motion.div
          role="status"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-ink2/95 px-4 py-3 shadow-lift backdrop-blur"
        >
          <span className="text-xl">{needRefresh ? "✨" : "📲"}</span>
          <p className="flex-1 text-sm text-paper">
            {needRefresh ? "Nouvelle version de NIO FAR disponible." : "NIO FAR est prêt à s'ouvrir même hors connexion."}
          </p>
          {needRefresh && (
            <>
              <button onClick={() => setNeedRefresh(false)} className="text-xs text-mute hover:text-sand">
                Plus tard
              </button>
              <button onClick={() => updateServiceWorker(true)} className="btn-clay px-3 py-1.5 text-xs">
                Mettre à jour
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Bouton « Installer l'app » (Android/desktop) ou astuce iOS. */
export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => typeof window !== "undefined" && isStandalone());
  const [showIosHint, setShowIosHint] = useState(false);
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!deferred && !isIos)) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            await deferred.userChoice.catch(() => null);
            setDeferred(null);
          } else {
            setShowIosHint((s) => !s);
          }
        }}
        className="inline-flex items-center gap-2 rounded-full border border-saffron/50 bg-saffron/10 px-4 py-1.5 text-xs font-semibold text-saffron transition hover:bg-saffron/20"
      >
        📲 Installer l'app
      </button>
      <AnimatePresence>
        {showIosHint && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-w-xs overflow-hidden text-center text-xs text-sand"
          >
            Sur iPhone : touche <strong>Partager</strong> <span aria-hidden>⎋</span> puis <strong>« Sur l'écran d'accueil »</strong>.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Bandeau discret quand l'appareil est hors ligne. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-[70] mx-auto w-fit rounded-b-xl bg-bissap px-4 py-1.5 text-xs font-semibold text-paper shadow-lift"
        >
          Hors connexion — on reprend dès que le réseau revient
        </motion.div>
      )}
    </AnimatePresence>
  );
}
