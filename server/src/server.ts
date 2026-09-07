import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { router } from "./routes";
import { registerSocketHandlers } from "./socket";
import { apiRateLimiter } from "./middleware/rateLimit";
import { logger } from "./utils/logger";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(apiRateLimiter);
app.use("/api", router);

const httpServer = http.createServer(app);

// Socket.IO sur le même serveur HTTP — un seul port à exposer en
// production (voir README section Déploiement : pas de serverless classique).
const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, credentials: true },
  pingInterval: 10_000,
  pingTimeout: 20_000, // tolérance aux coupures réseau courtes avant de déclencher "disconnect"
});

registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  logger.info(`NIO FAR server démarré sur le port ${PORT}`, { clientUrl: CLIENT_URL });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM reçu, arrêt propre du serveur...");
  httpServer.close(() => process.exit(0));
});
