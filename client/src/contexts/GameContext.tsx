import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { socket, emitWithAck } from "../socket";
import { PublicRoomState, QuestionPayload, ChatMessage, FinalResult } from "../types";

type ConnectionStatus = "online" | "reconnecting" | "offline";

interface GameContextValue {
  playerId: string | null;
  roomState: PublicRoomState | null;
  currentQuestion: QuestionPayload | null;
  messages: ChatMessage[];
  partnerStatus: ConnectionStatus;
  lastReveal: { answers: Record<string, string>; isMatch: boolean } | null;
  finalResult: FinalResult | null;
  resetSession: () => void;
  createRoom: (displayName: string, gameType: string) => Promise<{ code: string; roomId: string } | null>;
  joinRoom: (displayName: string, code: string) => Promise<boolean>;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  submitAnswer: (value: string) => void;
  nextQuestion: () => void;
  sendChat: (text: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const STORAGE_KEY = "niofar_session";

export function GameProvider({ children }: { children: ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<PublicRoomState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerStatus, setPartnerStatus] = useState<ConnectionStatus>("online");
  const [lastReveal, setLastReveal] = useState<{ answers: Record<string, string>; isMatch: boolean } | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const roomIdRef = useRef<string | null>(null);

  // Tentative de reprise automatique après refresh / reconnexion (cas #24.4, #24.12)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { roomId, playerId: pid } = JSON.parse(saved);
      roomIdRef.current = roomId;
      setPlayerId(pid);
      socket.emit("player:reconnect", { roomId, playerId: pid }, (res: { ok: boolean; state?: PublicRoomState }) => {
        if (res.ok && res.state) setRoomState(res.state);
      });
    }

    socket.on("connect", () => setPartnerStatus((s) => (s === "offline" ? "online" : s)));
    socket.on("disconnect", () => setPartnerStatus("reconnecting"));

    socket.on("room:player_joined", ({ state }: { state: PublicRoomState }) => setRoomState(state));
    socket.on("room:state", ({ state }: { state: PublicRoomState }) => setRoomState(state));
    socket.on("room:player_left", () => setPartnerStatus("offline"));
    socket.on("player:disconnect", () => setPartnerStatus("reconnecting"));
    socket.on("player:reconnect", ({ state }: { state: PublicRoomState }) => {
      setPartnerStatus("online");
      setRoomState(state);
    });
    socket.on("game:resume", ({ state, currentQuestion }: { state: PublicRoomState; currentQuestion: QuestionPayload | null }) => {
      setRoomState(state);
      setCurrentQuestion(currentQuestion);
    });
    socket.on("game:start", ({ state }: { state: PublicRoomState }) => setRoomState(state));
    socket.on("question:send", ({ question }: { question: QuestionPayload }) => {
      setCurrentQuestion(question);
      setLastReveal(null);
    });
    socket.on("answer:received", ({ answeredPlayerIds }: { answeredPlayerIds: string[] }) => {
      setRoomState((prev) => (prev ? { ...prev, answeredPlayerIds } : prev));
    });
    socket.on("answers:reveal", ({ answers, isMatch, scores }: { answers: Record<string, string>; isMatch: boolean; scores: Record<string, number> }) => {
      setLastReveal({ answers, isMatch });
      setRoomState((prev) => (prev ? { ...prev, scores } : prev));
    });
    socket.on("game:finished", (data: { result?: FinalResult; state?: PublicRoomState; abandoned?: boolean; reason?: string }) => {
      if (data.abandoned) {
        setFinalResult({ coupleScorePct: 0, player1Score: 0, player2Score: 0, abandoned: true, reason: data.reason });
      } else if (data.result) {
        setRoomState(data.state ?? null);
        setFinalResult(data.result);
      }
    });
    socket.on("chat:message", (msg: ChatMessage) => setMessages((prev) => [...prev, msg]));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room:player_joined");
      socket.off("room:state");
      socket.off("room:player_left");
      socket.off("player:disconnect");
      socket.off("player:reconnect");
      socket.off("game:resume");
      socket.off("game:start");
      socket.off("question:send");
      socket.off("answer:received");
      socket.off("answers:reveal");
      socket.off("game:finished");
      socket.off("chat:message");
    };
  }, []);

  async function createRoom(displayName: string, gameType: string) {
    const res = await emitWithAck<{ ok: boolean; roomId: string; code: string; playerId: string; state: PublicRoomState }>(
      "room:create",
      { displayName, gameType }
    );
    if (!res.ok) return null;
    roomIdRef.current = res.roomId;
    setPlayerId(res.playerId);
    setRoomState(res.state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId: res.roomId, playerId: res.playerId }));
    return { code: res.code, roomId: res.roomId };
  }

  async function joinRoom(displayName: string, code: string) {
    const res = await emitWithAck<{ ok: boolean; roomId: string; playerId: string; state: PublicRoomState; error?: string }>(
      "room:join",
      { displayName, code }
    );
    if (!res.ok) return false;
    roomIdRef.current = res.roomId;
    setPlayerId(res.playerId);
    setRoomState(res.state);
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

  function submitAnswer(value: string) {
    if (!roomIdRef.current) return;
    socket.emit("answer:submit", { roomId: roomIdRef.current, value });
  }

  function nextQuestion() {
    if (!roomIdRef.current) return;
    socket.emit("game:next_question", { roomId: roomIdRef.current });
  }

  function sendChat(text: string) {
    if (!roomIdRef.current) return;
    socket.emit("chat:message", { roomId: roomIdRef.current, text });
  }

  function resetSession() {
    localStorage.removeItem(STORAGE_KEY);
    roomIdRef.current = null;
    setPlayerId(null);
    setRoomState(null);
    setCurrentQuestion(null);
    setLastReveal(null);
    setFinalResult(null);
    setMessages([]);
  }

  return (
    <GameContext.Provider
      value={{
        playerId,
        roomState,
        currentQuestion,
        messages,
        partnerStatus,
        lastReveal,
        finalResult,
        resetSession,
        createRoom,
        joinRoom,
        setReady,
        startGame,
        submitAnswer,
        nextQuestion,
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
