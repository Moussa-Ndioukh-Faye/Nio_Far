/** Vibration courte sur mobile (ignorée silencieusement ailleurs). */
export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* certains navigateurs refusent sans geste utilisateur : sans importance */
  }
}
