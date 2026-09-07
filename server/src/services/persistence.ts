import { prisma } from "./contentService";
import { logger } from "../utils/logger";

/**
 * Persistance côté joueur. Le client envoie uniquement des intentions ;
 * cette couche n'est qu'un miroir (best-effort) de l'état en mémoire,
 * nécessaire pour que les FKs (ChatMessage.playerId, Answer.playerId…)
 * restent valides — sinon l'insertion du chat échouait en silence.
 */

export async function upsertPlayerConnection(params: {
  playerId: string;
  sessionId: string;
  socketId: string;
  displayName: string;
  isConnected?: boolean;
}): Promise<void> {
  try {
    await prisma.player.upsert({
      where: { id: params.playerId },
      create: {
        id: params.playerId,
        sessionId: params.sessionId,
        socketId: params.socketId,
        displayName: params.displayName,
        isConnected: params.isConnected ?? true,
      },
      update: {
        socketId: params.socketId,
        displayName: params.displayName,
        isConnected: params.isConnected ?? true,
      },
    });
  } catch (e) {
    logger.warn("Persist player failed", { playerId: params.playerId, error: e });
  }
}

export async function markPlayerDisconnected(playerId: string): Promise<void> {
  try {
    await prisma.player.update({
      where: { id: playerId },
      data: { isConnected: false, socketId: null },
    });
  } catch (e) {
    logger.warn("Mark player disconnected failed", { playerId, error: e });
  }
}