import rateLimit from "express-rate-limit";

// Limite large pour l'API REST (création de session, health check).
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, réessaie dans un instant." },
});

/**
 * Rate limiting "maison" pour les événements Socket.IO (express-rate-limit
 * ne s'applique qu'à Express). Compteur en mémoire par socket.id, fenêtre
 * glissante simple — suffisant pour le MVP, à remplacer par Redis si scale.
 */
const socketHits: Map<string, number[]> = new Map();

export function isSocketRateLimited(socketId: string, max = 20, windowMs = 5000): boolean {
  const now = Date.now();
  const hits = (socketHits.get(socketId) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  socketHits.set(socketId, hits);
  return hits.length > max;
}

export function clearSocketRateLimit(socketId: string) {
  socketHits.delete(socketId);
}
