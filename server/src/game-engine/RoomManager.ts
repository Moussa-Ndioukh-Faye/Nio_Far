import { Category, Difficulty, GameFamily, GameType } from "../types";
import { getCatalogEntry } from "./catalog";
import { GameEngine } from "./GameEngine";
import { DeckCard } from "./rules";
import { createRules } from "./rules/index";
import { generateRoomCode } from "../utils/roomCode";
import { logger } from "../utils/logger";

const ROOM_TTL_MS = 1000 * 60 * 60 * 6; // 6h — au-delà, une room inactive est nettoyée (règle #24.10)

interface RoomEntry {
  engine: GameEngine;
  lastActivityAt: number;
}

export interface CreateRoomOptions {
  gameType: GameType;
  difficulty: Difficulty;
  hostId: string;
  deck: DeckCard[];
}

/**
 * Registre en mémoire des rooms actives. Pour un déploiement multi-instance
 * (scale horizontal), remplacer par un store partagé (Redis) — l'interface
 * publique resterait la même.
 */
export class RoomManager {
  private rooms: Map<string, RoomEntry> = new Map(); // roomId -> entry
  private codeToRoomId: Map<string, string> = new Map(); // code -> roomId

  createRoom(params: CreateRoomOptions): GameEngine {
    let code = generateRoomCode();
    while (this.codeToRoomId.has(code)) code = generateRoomCode(); // évite collision

    const roomId = `room_${code}`;
    const game = getCatalogEntry(params.gameType);
    const cardTypes = game.cardType === "MIXED" ? [...game.options] : [game.cardType];
    const engine = new GameEngine({
      roomId,
      code,
      gameType: params.gameType,
      category: game.category as Category,
      difficulty: params.difficulty,
      gameName: game.name,
      family: game.family as GameFamily,
      scoringEnabled: game.scoringEnabled,
      totalRounds: game.roundsByDifficulty[params.difficulty],
      hostId: params.hostId,
      deck: params.deck,
      buildRules: createRules(game.family as GameFamily, cardTypes),
    });

    this.rooms.set(roomId, { engine, lastActivityAt: Date.now() });
    this.codeToRoomId.set(code, roomId);
    logger.info("Room créée", { roomId, code, gameType: params.gameType, difficulty: params.difficulty });
    return engine;
  }

  getByCode(code: string): GameEngine | null {
    const roomId = this.codeToRoomId.get(code.toUpperCase());
    if (!roomId) return null;
    return this.getById(roomId);
  }

  getById(roomId: string): GameEngine | null {
    const entry = this.rooms.get(roomId);
    if (!entry) return null;
    entry.lastActivityAt = Date.now();
    return entry.engine;
  }

  touch(roomId: string) {
    const entry = this.rooms.get(roomId);
    if (entry) entry.lastActivityAt = Date.now();
  }

  destroyRoom(roomId: string) {
    const entry = this.rooms.get(roomId);
    if (!entry) return;
    this.codeToRoomId.delete(entry.engine.getCode());
    this.rooms.delete(roomId);
    logger.info("Room détruite", { roomId });
  }

  /** À appeler périodiquement (voir server.ts) pour nettoyer les rooms inactives. */
  cleanupExpired() {
    const now = Date.now();
    for (const [roomId, entry] of this.rooms.entries()) {
      if (now - entry.lastActivityAt > ROOM_TTL_MS) {
        this.destroyRoom(roomId);
      }
    }
  }

  size(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();