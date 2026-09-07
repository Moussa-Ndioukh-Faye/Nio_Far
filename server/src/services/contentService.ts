import { PrismaClient, GameType as PrismaGameType } from "@prisma/client";
import { ContentItem } from "../game-engine/GameEngine";
import { GameType } from "../types";

const prisma = new PrismaClient();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Charge et mélange les questions pour un type de jeu donné.
 * Pour TRUTH_OR_DARE, on convertit les Challenges au format ContentItem
 * générique (une seule "option" implicite : accepter ou passer, géré côté
 * socket handler plutôt que comme choix multiple).
 */
export async function loadContentForGame(gameType: GameType, count = 20): Promise<ContentItem[]> {
  if (gameType === "TRUTH_OR_DARE") {
    const challenges = await prisma.challenge.findMany();
    return shuffle(challenges)
      .slice(0, count)
      .map((c) => ({ id: c.id, prompt: c.text, options: ["✅ Fait", "🔄 Passer"] }));
  }

  const prismaType: PrismaGameType = gameType as unknown as PrismaGameType;
  const questions = await prisma.question.findMany({ where: { gameType: prismaType } });
  return shuffle(questions)
    .slice(0, count)
    .map((q) => ({ id: q.id, prompt: q.prompt, options: q.options }));
}

export { prisma };
