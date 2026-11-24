import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { socket, emitWithAck } from "../socket";
import { SessionPublicState, ChatMessage, GameType, Difficulty } from "../types";
import { getDeviceId } from "../data/catalog";

type ConnectionStatus = "online" | "reconnecting" | "offline";

interface GameContextValue {
  playerId: string | null;
  /** true tant qu'une reprise de session (après refresh / coupure) est en cours */
  restoring: boolean;
  /** état de MA connexion au serveur (distinct de celui du partenaire) */
  selfStatus: ConnectionStatus;
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
  /** à appeler à chaque frappe dans le chat (limité côté client) */
  notifyTyping: () => void;
  partnerTyping: boolean;
  requestRematch: () => void;
  /** décalage horloge serveur - horloge locale (ms), pour les chronos */
  clockOffset: number;
}

const GameContext = createContext<GameContextValue | null>(null);

const STORAGE_KEY = "niofar_session";

export function GameProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<SessionPublicState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerStatus, setPartnerStatus] = useState<ConnectionStatus>("online");
  const [selfStatus, setSelfStatus] = useState<ConnectionStatus>(socket.connected ? "online" : "reconnecting");
  const [restoring, setRestoring] = useState<boolean>(() => !!localStorage.getItem(STORAGE_KEY));
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const roomIdRef = useRef<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const typingSentAt = useRef(0);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chaque état reçu porte l'horloge serveur : on en déduit le décalage
  // (approximation suffisante pour un compte à rebours à la seconde).
  function applyState(s: SessionPublicState) {
    if (typeof s.serverNow === "number") setClockOffset(s.serverNow - Date.now());
    setState(s);
  }
  const deviceId = getDeviceId();

  // Reprise de session : au chargement ET à chaque (re)connexion du socket.
  // Après une coupure réseau, socket.io obtient un NOUVEL id : sans ce
  // player:reconnect, le serveur ne le rattache pas à la room et la partie
  // finit ABANDONED au bout du délai de grâce.
  useEffect(() => {
    function restoreSession() {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setRestoring(false);
        return;
      }
      let session: { roomId: string; playerId: string };
      try {
        session = JSON.parse(saved);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setRestoring(false);
        return;
      }
      roomIdRef.current = session.roomId;
      playerIdRef.current = session.playerId;
      setPlayerId(session.playerId);
      setRestoring(true);
      socket.emit(
        "player:reconnect",
        { roomId: session.roomId, playerId: session.playerId },
        (res: { ok: boolean; state?: SessionPublicState; messages?: ChatMessage[]; error?: string }) => {
          if (res?.ok && res.state) {
            applyState(res.state);
            if (Array.isArray(res.messages)) setMessages(res.messages);
          } else if (res?.error === "ROOM_NOT_FOUND" || res?.error === "PLAYER_NOT_FOUND") {
            // La room n'existe plus (expirée / serveur redémarré) : on repart propre.
            localStorage.removeItem(STORAGE_KEY);
            roomIdRef.current = null;
            playerIdRef.current = null;
            setPlayerId(null);
            setState(null);
          }
          setRestoring(false);
        }
      );
    }

    function onConnect() {
      setSelfStatus("online");
      restoreSession();
    }
    function onDisconnect() { setSelfStatus("reconnecting"); }

    function onStateUpdate(s: SessionPublicState) { applyState(s); }
    function onPlayerJoined({ state: s }: { state: SessionPublicState }) { applyState(s); setPartnerStatus("online"); }
    function onPlayerLeft({ playerId: pid }: { playerId: string }) { if (pid !== playerIdRef.current) setPartnerStatus("offline"); }
    function onPlayerDisconnect({ playerId: pid }: { playerId: string }) { if (pid !== playerIdRef.current) setPartnerStatus("reconnecting"); }
    function onPlayerReconnect({ playerId: pid }: { playerId: string }) { if (pid !== playerIdRef.current) setPartnerStatus("online"); }
    function onChatMessage(msg: ChatMessage) {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.playerId !== playerIdRef.current) setPartnerTyping(false);
    }
    function onChatTyping({ playerId: pid, typing }: { playerId: string; typing: boolean }) {
      if (pid === playerIdRef.current) return;
      setPartnerTyping(typing);
      if (partnerTypingTimer.current) clearTimeout(partnerTypingTimer.current);
      // filet de sécurité si le « stop » se perd
      if (typing) partnerTypingTimer.current = setTimeout(() => setPartnerTyping(false), 5000);
    }

    // Le socket peut s'être connecté AVANT que ces listeners existent : on
    // aligne l'état tout de suite, sinon on afficherait « hors ligne » à tort.
    if (socket.connected) {
      setSelfStatus("online");
      restoreSession(); // sinon onConnect s'en charge
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state:update", onStateUpdate);
    socket.on("room:player_joined", onPlayerJoined);
    socket.on("room:player_left", onPlayerLeft);
    socket.on("player:disconnect", onPlayerDisconnect);
    socket.on("player:reconnect", onPlayerReconnect);
    socket.on("chat:message", onChatMessage);
    socket.on("chat:typing", onChatTyping);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state:update", onStateUpdate);
      socket.off("room:player_joined", onPlayerJoined);
      socket.off("room:player_left", onPlayerLeft);
      socket.off("player:disconnect", onPlayerDisconnect);
      socket.off("player:reconnect", onPlayerReconnect);
      socket.off("chat:message", onChatMessage);
      socket.off("chat:typing", onChatTyping);
    };
  }, []);

  async function createRoom(displayName: string, gameType: GameType, difficulty: Difficulty) {
    const res = await emitWithAck<{ ok: boolean; roomId: string; code: string; playerId: string; state: SessionPublicState; error?: string }>(
      "room:create",
      { displayName, gameType, difficulty, deviceId }
    );
    if (!res.ok) return null;
    roomIdRef.current = res.roomId;
    playerIdRef.current = res.playerId;
    setPlayerId(res.playerId);
    applyState(res.state);
    setMessages([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId: res.roomId, playerId: res.playerId }));
    return { code: res.code, roomId: res.roomId };
  }

  async function joinRoom(displayName: string, code: string) {
    const res = await emitWithAck<{ ok: boolean; roomId: string; playerId: string; state: SessionPublicState; messages?: ChatMessage[]; error?: string }>(
      "room:join",
      { displayName, code, deviceId }
    );
    if (!res.ok) return false;
    roomIdRef.current = res.roomId;
    playerIdRef.current = res.playerId;
    setPlayerId(res.playerId);
    applyState(res.state);
    setMessages(Array.isArray(res.messages) ? res.messages : []);
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
    stopTyping();
  }

  function stopTyping() {
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = null;
    if (typingSentAt.current && roomIdRef.current) {
      socket.emit("chat:typing", { roomId: roomIdRef.current, typing: false });
    }
    typingSentAt.current = 0;
  }

  function notifyTyping() {
    if (!roomIdRef.current) return;
    const now = Date.now();
    // au plus un « je tape » toutes les 2 s, et un « stop » après 3 s sans frappe
    if (now - typingSentAt.current > 2000) {
      socket.emit("chat:typing", { roomId: roomIdRef.current, typing: true });
      typingSentAt.current = now;
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(stopTyping, 3000);
  }

  function requestRematch() {
    if (!roomIdRef.current) return;
    socket.emit("game:rematch", { roomId: roomIdRef.current });
  }

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY);
    roomIdRef.current = null;
    playerIdRef.current = null;
    setPlayerId(null);
    setState(null);
    setMessages([]);
    setPartnerStatus("online");
    setPartnerTyping(false);
  }

  return (
    <GameContext.Provider
      value={{
        playerId,
        restoring,
        selfStatus,
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
        notifyTyping,
        partnerTyping,
        requestRematch,
        clockOffset,
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