import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import { Server } from "socket.io";
import { router } from "./routes";
import { registerSocketHandlers } from "./socket";
import { apiRateLimiter } from "./middleware/rateLimit";
import { logger } from "./utils/logger";
import { startRetentionJob } from "./services/retention";

const PORT = Number(process.env.PORT ?? 4000);
// Une ou plusieurs adresses du frontend, séparées par des virgules
// (ex. « https://nio-far.vercel.app,https://nio-far.netlify.app »).
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
const ALLOWED_ORIGINS = CLIENT_URL.split(",").map((u) => u.trim().replace(/\/$/, "")).filter(Boolean);

const app = express();
// Render / Railway placent l'app derrière un proxy : sans ça, toutes les
// requêtes semblent venir de la même IP et la limite anti-abus bloque tout le monde.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet()); // en-têtes de sécurité (OWASP) : nosniff, frameguard, HSTS…
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: "10kb" }));
app.use(apiRateLimiter);
app.use("/api", router);

const httpServer = http.createServer(app);

// Socket.IO sur le même serveur HTTP — un seul port à exposer en
// production (voir README section Déploiement : pas de serverless classique).
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  maxHttpBufferSize: 16 * 1024, // aucun message de jeu n'a besoin de plus
  pingInterval: 10_000,
  pingTimeout: 20_000, // tolérance aux coupures réseau courtes avant de déclencher "disconnect"
});

registerSocketHandlers(io);
startRetentionJob();

httpServer.listen(PORT, () => {
  logger.info(`NIO FAR server démarré sur le port ${PORT}`, { allowedOrigins: ALLOWED_ORIGINS });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM reçu, arrêt propre du serveur...");
  httpServer.close(() => process.exit(0));
});
