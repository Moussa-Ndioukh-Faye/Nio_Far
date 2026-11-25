import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mark, Wordmark } from "./Mark";

const KEY = "niofar_splash_seen";

/**
 * « La pièce s'allume » : le logo apparaît, puis l'app se révèle dans un
 * cercle qui s'ouvre (clip-path) en sortant du flou. Une fois par session.
 */
export function Splash() {
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem(KEY) && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* rien */
    }
    const t = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-ink"
          initial={{ clipPath: "circle(150% at 50% 45%)" }}
          exit={{ clipPath: "circle(0% at 50% 45%)", filter: "blur(22px)" }}
          transition={{ duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0, filter: "blur(18px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <Mark size={120} />
          </motion.div>
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="text-5xl"
          >
            <Wordmark />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
