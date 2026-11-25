import { describe, expect, it, vi } from "vitest";

const deleteManySessions = vi.fn(async (_: unknown) => ({ count: 3 }));
const deleteManyPlayers = vi.fn(async (_: unknown) => ({ count: 2 }));
vi.mock("../services/contentService", () => ({
  prisma: { gameSession: { deleteMany: deleteManySessions }, player: { deleteMany: deleteManyPlayers } },
}));

const { purgeOldSessions, eraseDevice, RETENTION_DAYS } = await import("../services/retention");

describe("Conservation et effacement des données", () => {
  it("supprime les parties plus vieilles que la durée de conservation", async () => {
    const now = Date.UTC(2026, 10, 25);
    expect(await purgeOldSessions(now)).toBe(3);
    const where = (deleteManySessions.mock.calls[0][0] as { where: { createdAt: { lt: Date } } }).where;
    expect(where.createdAt.lt.getTime()).toBe(now - RETENTION_DAYS * 86_400_000);
  });

  it("efface tout ce qui est lié à un appareil", async () => {
    expect(await eraseDevice("dev_abc12345")).toBe(2);
    expect(deleteManyPlayers).toHaveBeenCalledWith({ where: { deviceId: "dev_abc12345" } });
  });
});
