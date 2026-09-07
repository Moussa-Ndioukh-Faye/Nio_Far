import { Router } from "express";
import { prisma } from "../services/contentService";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
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
