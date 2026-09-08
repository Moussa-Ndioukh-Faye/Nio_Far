import { z } from "zod";
import { DIFFICULTIES, GAME_TYPES } from "../types";

export const difficultySchema = z.enum(DIFFICULTIES);

export const createRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  gameType: z.enum(GAME_TYPES),
  difficulty: difficultySchema.default("NORMAL"),
  deviceId: z.string().trim().min(8).max(80).optional(),
});

export const joinRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  code: z.string().trim().min(4).max(10),
  playerId: z.string().optional(), // fourni si reconnexion avec un id déjà connu (localStorage côté client)
  deviceId: z.string().trim().min(8).max(80).optional(),
});

export const gameActSchema = z.object({
  roomId: z.string(),
  action: z.string().trim().min(1).max(30),
  payload: z.unknown().optional(),
});

export const gameNextSchema = z.object({
  roomId: z.string(),
});

export const chatMessageSchema = z.object({
  roomId: z.string(),
  text: z.string().trim().min(1).max(500),
});

export const reconnectSchema = z.object({
  roomId: z.string(),
  playerId: z.string(),
});

export function safeParse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }, data: unknown) {
  return schema.safeParse(data);
}
