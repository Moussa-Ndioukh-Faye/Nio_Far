import { z } from "zod";

export const createRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  gameType: z.enum(["GUESS_ME", "COUPLE_BATTLE", "TRUTH_OR_DARE"]),
});

export const joinRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  code: z.string().trim().min(4).max(10),
  playerId: z.string().optional(), // fourni si reconnexion avec un id déjà connu (localStorage côté client)
});

export const answerSubmitSchema = z.object({
  roomId: z.string(),
  value: z.string().min(1).max(120),
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
