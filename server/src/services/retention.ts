import { prisma } from "./contentService";
import { logger } from "../utils/logger";

/**
 * Durée de conservation (RGPD art. 5-1-e / loi sénégalaise n° 2008-12, art. 35) :
 * les parties — et donc prénoms, réponses et messages — sont supprimées
 * automatiquement au bout de RETENTION_DAYS jours.
 */
export const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 30);

export async function purgeOldSessions(now = Date.now()): Promise<number> {
  const limit = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  // Les joueurs, réponses, messages, résultats et événements suivent (onDelete: Cascade).
  const res = await prisma.gameSession.deleteMany({ where: { createdAt: { lt: limit } } });
  return res.count;
}

export function startRetentionJob() {
  const run = () =>
    purgeOldSessions()
      .then((n) => n > 0 && logger.info(`Conservation : ${n} partie(s) de plus de ${RETENTION_DAYS} j supprimée(s)`))
      .catch((e: unknown) => logger.warn("Purge de conservation échouée", e));
  setTimeout(run, 60_000); // peu après le démarrage
  setInterval(run, 24 * 60 * 60 * 1000).unref?.();
}

/**
 * Droit à l'effacement : supprime tout ce qui est lié à cet appareil
 * (fiches joueur, et en cascade ses réponses et messages).
 */
export async function eraseDevice(deviceId: string): Promise<number> {
  const res = await prisma.player.deleteMany({ where: { deviceId } });
  return res.count;
}
