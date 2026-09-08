import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { socket, emitWithAck } from "../socket";
import { SessionPublicState, ChatMessage, GameType, Difficulty } from "../types";
import { getDeviceId } from "../data/catalog";

type ConnectionStatus = "online" | "reconnecting" | "offline";

interface GameContextValue {
  playerId: string | null;
  state: SessionPublicState | null;
  messages: ChatMessage[];
  partnerStatus: ConnectionStatus;
  deviceId: string;
  resetSession: () => void;
  createRoom: (displayName: string, gameType: GameType, difficulty: Difficulty) => Promise<{ code: string; roomId: string } | null>;
  joinRoom: (displayName: string, code: string) => Promise<boolean>;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  act: (action: string, payload?: unknown) => void;
  next: () => void;
  sendChat: (text: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const STORAGE_KEY = "niofar_session";

export function GameProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<SessionPublicState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerStatus, setPartnerStatus] = useState<ConnectionStatus>("online");
  const roomIdRef = useRef<string | null>(null);
  const deviceId = getDeviceId();

  // Reprise automatique après refresh / reconnexion
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { roomId, playerId: pid } = JSON.parse(saved);
        roomIdRef.current = roomId;
        setPlayerId(pid);
        socket.emit("player:reconnect", { roomId, playerId: pid }, (res: { ok: boolean; state?: SessionPublicState }) => {
          if (res.ok && res.state) setState(res.state);
        });
      } catch { /* ignore corrupt session */ }
    }

    function onConnect() { setPartnerStatus((s) => (s === "offline" ? "online" : s)); }
    function onDisconnect() { setPartnerStatus("reconnecting"); }

    function onStateUpdate(s: SessionPublicState) { setState(s); }
    function onPlayerJoined({ state: s }: { state: SessionPublicState }) { setState(s); }
    function onPlayerLeft() { setPartnerStatus("offline"); }
    function onPlayerDisconnect() { setPartnerStatus("reconnecting"); }
    function onPlayerReconnect() { setPartnerStatus("online"); }
    function onChatMessage(msg: ChatMessage) { setMessages((prev) => [...prev, msg]); }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state:update", onStateUpdate);
    socket.on("room:player_joined", onPlayerJoined);
    socket.on("room:player_left", onPlayerLeft);
    socket.on("player:disconnect", onPlayerDisconnect);
    socket.on("player:reconnect", onPlayerReconnect);
    socket.on("chat:message", onChatMessage);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state:update", onStateUpdate);
      socket.off("room:player_joined", onPlayerJoined);
      socket.off("room:player_left", onPlayerLeft);
      socket.off("player:disconnect", onPlayerDisconnect);
      socket.off("player:reconnect", onPlayerReconnect);
      socket.off("chat:message", onChatMessage);
    };
  }, []);

  async function createRoom(displayName: string, gameType: GameType, difficulty: Difficulty) {
    const res = await emitWithAck<{ ok: boolean; roomId: string; code: string; playerId: string; state: SessionPublicState; error?: string }>(
      "room:create",
      { displayName, gameType, difficulty, deviceId }
    );
    if (!res.ok) return null;
    roomIdRef.current = res.roomId;
    setPlayerId(res.playerId);
    setState(res.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId: res.roomId, playerId: res.playerId }));
    return { code: res.code, roomId: res.roomId };
  }

  async function joinRoom(displayName: string, code: string) {
    const res = await emitWithAck<{ ok: boolean; roomId: string; playerId: string; state: SessionPublicState; error?: string }>(
      "room:join",
      { displayName, code, deviceId }
    );
    if (!res.ok) return false;
    roomIdRef.current = res.roomId;
    setPlayerId(res.playerId);
    setState(res.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId: res.roomId, playerId: res.playerId }));
    return true;
  }

  function setReady(ready: boolean) {
    if (!roomIdRef.current) return;
    socket.emit("player:ready", { roomId: roomIdRef.current, ready });
  }

  function startGame() {
    if (!roomIdRef.current) return;
    socket.emit("game:start", { roomId: roomIdRef.current });
  }

  function act(action: string, payload?: unknown) {
    if (!roomIdRef.current) return;
    socket.emit("game:act", { roomId: roomIdRef.current, action, payload });
  }

  function next() {
    if (!roomIdRef.current) return;
    socket.emit("game:next", { roomId: roomIdRef.current });
  }

  function sendChat(text: string) {
    if (!roomIdRef.current) return;
    socket.emit("chat:message", { roomId: roomIdRef.current, text });
  }

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY);
    roomIdRef.current = null;
    setPlayerId(null);
    setState(null);
    setMessages([]);
  }

  return (
    <GameContext.Provider
      value={{
        playerId,
        state,
        messages,
        partnerStatus,
        deviceId,
        resetSession,
        createRoom,
        joinRoom,
        setReady,
        startGame,
        act,
        next,
        sendChat,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}