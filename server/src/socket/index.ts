import { Server, Socket } from "socket.io";
import { nanoid } from "nanoid/non-secure";
import { roomManager } from "../game-engine/RoomManager";
import { loadContentForGame, prisma } from "../services/contentService";
import { logger } from "../utils/logger";
import { isSocketRateLimited, clearSocketRateLimit } from "../middleware/rateLimit";
import {
  createRoomSchema,
  joinRoomSchema,
  answerSubmitSchema,
  chatMessageSchema,
  reconnectSchema,
} from "../middleware/validation";

// playerId <-> socket.id mapping pour retrouver un joueur lors d'une reconnexion
const playerSocketIndex: Map<string, string> = new Map(); // playerId -> current socketId
const socketPlayerIndex: Map<string, { playerId: string; roomId: string }> = new Map(); // socketId -> playerId/roomId

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info("Nouvelle connexion socket", { id: socket.id });

    // ---- room:create ----
    socket.on("room:create", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const playerId = nanoid();
      const questions = await loadContentForGame(parsed.data.gameType);
      const engine = roomManager.createRoom({
        gameType: parsed.data.gameType,
        hostId: playerId,
        questions,
      });
      engine.addPlayer({ id: playerId, displayName: parsed.data.displayName, socketId: socket.id });
      registerPlayerSocket(playerId, socket.id, engine.getRoomId());

      // Persistance (au minimum la création, pour audit / reprise)
      await prisma.gameSession
        .create({
          data: {
            id: engine.getRoomId(),
            code: engine.getCode(),
            gameType: parsed.data.gameType,
            status: "WAITING",
            hostPlayerId: playerId,
            questionOrder: questions.map((q) => q.id),
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 6),
          },
        })
        .catch((e: unknown) => logger.warn("Persist gameSession failed", e));

      socket.join(engine.getRoomId());
      ack?.({
        ok: true,
        roomId: engine.getRoomId(),
        code: engine.getCode(),
        playerId,
        state: engine.getPublicState(),
      });
    });

    // ---- room:join ----
    socket.on("room:join", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const engine = roomManager.getByCode(parsed.data.code);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const playerId = parsed.data.playerId ?? nanoid();
      const result = engine.addPlayer({
        id: playerId,
        displayName: parsed.data.displayName,
        socketId: socket.id,
      });

      if (!result.ok) {
        // Cas #24.7 : troisième utilisateur essaie de rejoindre.
        if (result.reason === "ROOM_FULL") return ack?.({ ok: false, error: "ROOM_FULL" });
        if (result.reason === "PLAYER_ALREADY_IN_ROOM") {
          // Cas #24.4 : refresh de page — traiter comme une reconnexion.
          engine.reconnectPlayer(playerId, socket.id);
        }
      }

      registerPlayerSocket(playerId, socket.id, engine.getRoomId());
      socket.join(engine.getRoomId());

      io.to(engine.getRoomId()).emit("room:player_joined", { state: engine.getPublicState() });
      ack?.({ ok: true, roomId: engine.getRoomId(), playerId, state: engine.getPublicState() });
    });

    // ---- player:ready ----
    socket.on("player:ready", (payload: { roomId: string; ready: boolean }, ack) => {
      if (guard(socket, ack)) return;
      const engine = roomManager.getById(payload.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      const ctx = socketPlayerIndex.get(socket.id);
      if (!ctx) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

      engine.setPlayerReady(ctx.playerId, payload.ready);
      io.to(engine.getRoomId()).emit("room:state", { state: engine.getPublicState() });
      ack?.({ ok: true });
    });

    // ---- game:start ----
    socket.on("game:start", async (payload: { roomId: string }, ack) => {
      if (guard(socket, ack)) return;
      const engine = roomManager.getById(payload.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (!engine.canStart()) return ack?.({ ok: false, error: "NOT_READY" });

      engine.start();
      await prisma.gameSession.update({ where: { id: engine.getRoomId() }, data: { status: "PLAYING" } }).catch(() => {});

      io.to(engine.getRoomId()).emit("game:start", { state: engine.getPublicState() });
      sendCurrentQuestion(io, engine);
      ack?.({ ok: true });
    });

    // ---- answer:submit ----
    socket.on("answer:submit", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = answerSubmitSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const engine = roomManager.getById(parsed.data.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      const ctx = socketPlayerIndex.get(socket.id);
      if (!ctx) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

      const result = engine.submitAnswer(ctx.playerId, parsed.data.value);
      if (!result.ok) return ack?.({ ok: false, error: result.reason }); // couvre la double-réponse (#24.8)

      // Informe l'autre joueur qu'une réponse est arrivée, SANS révéler sa valeur.
      io.to(engine.getRoomId()).emit("answer:received", {
        playerId: ctx.playerId,
        answeredPlayerIds: engine.getPublicState().answeredPlayerIds,
      });

      if (result.bothAnswered) {
        const { answers, isMatch, scoreDelta } = engine.reveal();
        io.to(engine.getRoomId()).emit("answers:reveal", { answers, isMatch, scoreDelta, scores: engine.getPublicState().scores });
        io.to(engine.getRoomId()).emit("score:update", { scores: engine.getPublicState().scores });
      }

      ack?.({ ok: true });
    });

    // ---- game:next_question ----
    socket.on("game:next_question", async (payload: { roomId: string }, ack) => {
      if (guard(socket, ack)) return;
      const engine = roomManager.getById(payload.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const { finished } = engine.nextQuestion();
      if (finished) {
        const result = engine.getFinalResult();
        await prisma.gameSession.update({ where: { id: engine.getRoomId() }, data: { status: "FINISHED" } }).catch(() => {});
        await prisma.gameResult
          .create({
            data: {
              sessionId: engine.getRoomId(),
              coupleScorePct: result.coupleScorePct,
              player1Score: result.player1Score,
              player2Score: result.player2Score,
              matchingAnswers: 0, // à affiner: dérivable du log GameEvent si besoin de détail
              differentAnswers: 0,
              bestStreak: 0,
            },
          })
          .catch(() => {});
        io.to(engine.getRoomId()).emit("game:finished", { result, state: engine.getPublicState() });
      } else {
        sendCurrentQuestion(io, engine);
      }
      ack?.({ ok: true });
    });

    // ---- chat:message ----
    socket.on("chat:message", async (payload, ack) => {
      if (guard(socket, ack)) return;
      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });
      const ctx = socketPlayerIndex.get(socket.id);
      if (!ctx) return ack?.({ ok: false, error: "NOT_IN_ROOM" });

      const message = {
        playerId: ctx.playerId,
        text: parsed.data.text,
        createdAt: Date.now(),
      };
      io.to(parsed.data.roomId).emit("chat:message", message);
      await prisma.chatMessage
        .create({ data: { sessionId: parsed.data.roomId, playerId: ctx.playerId, text: parsed.data.text } })
        .catch(() => {});
      ack?.({ ok: true });
    });

    // ---- player:reconnect (reconnexion explicite avec playerId connu, ex: après refresh) ----
    socket.on("player:reconnect", (payload, ack) => {
      const parsed = reconnectSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "INVALID_PAYLOAD" });

      const engine = roomManager.getById(parsed.data.roomId);
      if (!engine) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const reconnected = engine.reconnectPlayer(parsed.data.playerId, socket.id);
      if (!reconnected) return ack?.({ ok: false, error: "PLAYER_NOT_FOUND" });

      registerPlayerSocket(parsed.data.playerId, socket.id, engine.getRoomId());
      socket.join(engine.getRoomId());

      io.to(engine.getRoomId()).emit("player:reconnect", { playerId: parsed.data.playerId, state: engine.getPublicState() });
      // Renvoie l'état complet pour que le client resynchronise (question, score...)
      socket.emit("game:resume", {
        state: engine.getPublicState(),
        currentQuestion: engine.getCurrentQuestionForClient(),
      });
      ack?.({ ok: true, state: engine.getPublicState() });
    });

    // ---- déconnexion (coupure réseau, fermeture d'onglet — cas #24.5/6/11) ----
    socket.on("disconnect", () => {
      const ctx = socketPlayerIndex.get(socket.id);
      clearSocketRateLimit(socket.id);
      if (!ctx) return;

      const engine = roomManager.getById(ctx.roomId);
      if (!engine) return;

      io.to(ctx.roomId).emit("player:disconnect", { playerId: ctx.playerId });
      engine.markDisconnected(ctx.playerId, () => {
        // Grace period expirée -> partie abandonnée (règle #5)
        io.to(ctx.roomId).emit("game:finished", {
          abandoned: true,
          reason: "PARTNER_DISCONNECTED",
        });
        roomManager.destroyRoom(ctx.roomId);
      });

      socketPlayerIndex.delete(socket.id);
      // NB: on garde playerSocketIndex pour permettre reconnectPlayer() de le retrouver si besoin.
    });

    socket.on("room:leave", (payload: { roomId: string }) => {
      const engine = roomManager.getById(payload.roomId);
      const ctx = socketPlayerIndex.get(socket.id);
      if (engine && ctx) {
        engine.removePlayer(ctx.playerId);
        io.to(payload.roomId).emit("room:player_left", { playerId: ctx.playerId });
        socket.leave(payload.roomId);
      }
    });
  });

  // Nettoyage périodique des rooms inactives (règle #24.10 / #23 expiration)
  setInterval(() => roomManager.cleanupExpired(), 1000 * 60 * 10);
}

function registerPlayerSocket(playerId: string, socketId: string, roomId: string) {
  playerSocketIndex.set(playerId, socketId);
  socketPlayerIndex.set(socketId, { playerId, roomId });
}

function sendCurrentQuestion(io: Server, engine: ReturnType<typeof roomManager.getById>) {
  if (!engine) return;
  const question = engine.getCurrentQuestionForClient();
  if (question) io.to(engine.getRoomId()).emit("question:send", { question });
}

/** Garde anti-abus simple sur les événements les plus sensibles. */
function guard(socket: Socket, ack?: (res: unknown) => void): boolean {
  if (isSocketRateLimited(socket.id)) {
    ack?.({ ok: false, error: "RATE_LIMITED" });
    return true;
  }
  return false;
}
