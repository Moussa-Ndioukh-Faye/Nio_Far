import { io, Socket } from "socket.io-client";
import { getDeviceId } from "../data/catalog";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

// Un seul socket partagé pour toute l'app (créé au premier import).
// Le deviceId est envoyé en handshake pour identifier l'appareil (historique, reconnexion).
export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  auth: { deviceId: getDeviceId() },
});

// Helper générique pour un appel avec accusé de réception (ack), avec timeout.
export function emitWithAck<T = unknown>(event: string, payload: unknown, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${event}`)), timeoutMs);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}