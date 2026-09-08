import { SessionPublicState } from "../types";
import { StandardGame } from "./StandardGame";
import { TurnBasedGame } from "./TurnBasedGame";
import React from "react";

export interface GameComponentProps {
  state: SessionPublicState;
  playerId: string | null;
  act: (action: string, payload?: unknown) => void;
  next: () => void;
}

type GameComponent = React.ComponentType<GameComponentProps>;

const FAMILY_MAP: Record<string, GameComponent> = {
  STANDARD: StandardGame,
  TURN_BASED: TurnBasedGame,
};

export function getGameComponent(family: string): GameComponent | null {
  return FAMILY_MAP[family] ?? null;
}