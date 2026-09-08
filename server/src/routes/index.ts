import { Router } from "express";
import { prisma } from "../services/contentService";
import { CATEGORIES_ORDER, CATEGORY_LABELS, CATEGORY_GLYPHS, DIFFICULTY_LABELS, GAME_CATALOG } from "../game-engine/catalog";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Catalogue public : métadonnées des 24 jeux (le client s'en sert pour le grid).
router.get("/catalog", (_req, res) => {
  res.json({
    categories: CATEGORIES_ORDER.map((c) => ({ id: c, label: CATEGORY_LABELS[c], glyph: CATEGORY_GLYPHS[c] })),
    difficulties: (Object.keys(DIFFICULTY_LABELS) as (keyof typeof DIFFICULTY_LABELS)[]).map((d) => ({
      id: d,
      label: DIFFICULTY_LABELS[d],
    })),
    games: GAME_CATALOG.map((g) => ({
      type: g.type,
      name: g.name,
      category: g.category,
      tagline: g.tagline,
      description: g.description,
      glyph: g.glyph,
      family: g.family,
      scoringEnabled: g.scoringEnabled,
      rounds: g.roundsByDifficulty,
    })),
  });
});

// Historique des parties jouées sur un appareil (identité animée via deviceId).
router.get("/me/history", async (req, res) => {
  const deviceId = String(req.query.deviceId ?? "").trim();
  if (!deviceId || deviceId.length < 8) return res.status(400).json({ error: "MISSING_DEVICE_ID" });

  const players = await prisma.player.findMany({
    where: { deviceId },
    select: { sessionId: true },
  });
  const sessionIds = [...new Set(players.map((p) => p.sessionId))];
  if (sessionIds.length === 0) return res.json({ history: [] });

  const sessions = await prisma.gameSession.findMany({
    where: { id: { in: sessionIds } },
    include: {
      players: { select: { id: true, displayName: true, score: true } },
      results: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  res.json({
    history: sessions.map((s) => ({
      id: s.id,
      code: s.code,
      gameType: s.gameType,
      gameName: s.gameType,
      category: s.category,
      difficulty: s.difficulty,
      scoringEnabled: s.scoringEnabled,
      totalRounds: s.totalRounds,
      status: s.status,
      createdAt: s.createdAt,
      players: s.players.map((p) => ({ id: p.id, displayName: p.displayName, score: p.score })),
      result: s.results[0]
        ? {
            coupleScorePct: s.results[0].coupleScorePct,
            matchingAnswers: s.results[0].matchingAnswers,
            differentAnswers: s.results[0].differentAnswers,
          }
        : null,
    })),
  });
});

// Utile pour un lien "voir le résultat" partagé après la partie.
router.get("/sessions/:roomId/result", async (req, res) => {
  const result = await prisma.gameResult.findFirst({
    where: { sessionId: req.params.roomId },
    orderBy: { createdAt: "desc" },
  });
  if (!result) return res.status(404).json({ error: "NOT_FOUND" });
  res.json(result);
});