import { PrismaClient, Difficulty as PrismaDifficulty, GameType as PrismaGameType } from "@prisma/client";
import { DeckCard } from "../game-engine/rules";
import { Difficulty, GameType } from "../types";

export const prisma = new PrismaClient();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Charge et mélange les cartes de contenu d'un jeu à un niveau donné.
 * count = nombre de cartes souhaité (le ruleset ne pioche jamais au-delà).
 */
export async function loadDeck(gameType: GameType, difficulty: Difficulty, count: number): Promise<DeckCard[]> {
  const cards = await prisma.gameCard.findMany({
    where: {
      gameType: gameType as unknown as PrismaGameType,
      difficulty: difficulty as unknown as PrismaDifficulty,
      isActive: true,
    },
  });
  return shuffle(cards)
    .slice(0, count)
    .map((c) => ({ id: c.id, type: c.type, content: c.content, options: c.options }));
}

export async function loadDeckForGame(params: { gameType: GameType; difficulty: Difficulty; count: number }): Promise<DeckCard[]> {
  return loadDeck(params.gameType, params.difficulty, params.count);
}