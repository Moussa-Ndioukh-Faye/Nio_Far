import { GameFamily } from "../../types";
import { Ruleset, RulesetHost } from "../rules";
import { StandardRules } from "./StandardRules";
import { TurnBasedRules } from "./TurnBasedRules";

/** Fabrique l'implémentation de règles correspondant à une famille. */
export function createRules(family: GameFamily, cardTypes: string[]): (host: RulesetHost) => Ruleset {
  if (family === "TURN_BASED") {
    return (host) => new TurnBasedRules(host, cardTypes);
  }
  return (host) => new StandardRules(host);
}