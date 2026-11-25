import { Category, Difficulty, GameCatalogEntry, GameType } from "../types";

export const CATEGORIES_ORDER: Category[] = [
  "CONNAISSANCE",
  "ACTION_VERITE",
  "FUN",
  "ROMANTIC",
  "PROFOND",
  "FLIRT",
  "COMPETITION",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  CONNAISSANCE: "Connaissance",
  ACTION_VERITE: "Action & Vérité",
  FUN: "Fun",
  ROMANTIC: "Romantique",
  PROFOND: "Profond",
  FLIRT: "Flirt",
  COMPETITION: "Compétition",
};

export const CATEGORY_GLYPHS: Record<Category, string> = {
  CONNAISSANCE: "🧠",
  ACTION_VERITE: "🎭",
  FUN: "😂",
  ROMANTIC: "🌹",
  PROFOND: "🌌",
  FLIRT: "🔥",
  COMPETITION: "🏆",
};

/** Teinte d'accent par catégorie (classes Tailwind complètes pour le JIT). */
export const CATEGORY_ACCENTS: Record<Category, { ring: string; text: string; glow: string }> = {
  CONNAISSANCE: { ring: "border-saffron/40", text: "text-saffron", glow: "from-saffron/20" },
  ACTION_VERITE: { ring: "border-bissap/40", text: "text-bissap", glow: "from-bissap/20" },
  FUN: { ring: "border-saffron/40", text: "text-saffron", glow: "from-saffron/15" },
  ROMANTIC: { ring: "border-clay/50", text: "text-clay", glow: "from-clay/25" },
  PROFOND: { ring: "border-leaf/50", text: "text-leaf", glow: "from-leaf/20" },
  FLIRT: { ring: "border-bissap/50", text: "text-bissap", glow: "from-bissap/25" },
  COMPETITION: { ring: "border-saffron/50", text: "text-saffron", glow: "from-saffron/25" },
};

export const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  SOFT: "Léger, pour s'échauffer",
  NORMAL: "On creuse un peu",
  INTENSE: "Sans filtre (mais avec tendresse)",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  SOFT: "Doux",
  NORMAL: "Normal",
  INTENSE: "Intense",
};

export const DIFFICULTY_GLYPHS: Record<Difficulty, string> = {
  SOFT: "🟢",
  NORMAL: "🟡",
  INTENSE: "🔴",
};

const ROUNDS: Record<Difficulty, number> = { SOFT: 10, NORMAL: 15, INTENSE: 20 };

export const GAME_CATALOG: GameCatalogEntry[] = [
  { type: "GUESS_ME", name: "À quel point tu me connais ?", category: "CONNAISSANCE", tagline: "Devine mes goûts, mes rêves, mes habitudes.", description: "Questions sur l'un de vous : l'autre doit deviner sa réponse.", glyph: "💞", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS },
  { type: "GUESS_MY_ANSWER", name: "Devine ma réponse", category: "CONNAISSANCE", tagline: "Pense comme moi, réponds comme moi.", description: "Sur des cas concrets, trouve la réponse que ton/ta partenaire donnerait.", glyph: "🎯", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS },
  { type: "WHO_KNOWS_BEST", name: "Qui connaît le mieux l'autre ?", category: "CONNAISSANCE", tagline: "Duel de connaissances intimes.", description: "Mêmes questions, deux réponses : celui qui se rapproche le plus gagne.", glyph: "🥇", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS },
  { type: "TRUTH_OR_DARE", name: "Action ou Vérité", category: "ACTION_VERITE", isNew: true, tagline: "Le classique, en version couple.", description: "Tour à tour, choisis : vérité ou action. Tu peux toujours passer.", glyph: "⚖️", family: "TURN_BASED", scoringEnabled: true, rounds: ROUNDS },
  { type: "TRUTH", name: "Vérité", category: "ACTION_VERITE", tagline: "100% confidences.", description: "Chaque tour te pose une question intime.", glyph: "🫣", family: "TURN_BASED", scoringEnabled: true, rounds: ROUNDS },
  { type: "DARE", name: "Action", category: "ACTION_VERITE", tagline: "100% défis à faire.", description: "Chaque tour impose une petite action, tendre ou fun.", glyph: "🤸", family: "TURN_BASED", scoringEnabled: true, rounds: ROUNDS },
  { type: "WHO_IS_MORE", name: "Qui de nous deux ?", category: "FUN", tagline: "Le miroir du couple.", description: "« Qui des deux… ? » Chacun donne son nom, on compare.", glyph: "🤔", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS },
  { type: "WOULD_YOU_RATHER", name: "Tu préfères ?", category: "FUN", tagline: "Dilemmes absurdes et débats animés.", description: "Deux options impossibles à départager.", glyph: "🪄", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "NO_YES_NO", name: "Ni oui ni non", category: "FUN", tagline: "Réponds sans prononcer les mots interdits.", description: "Une question piège par tour. Interdit de dire « oui » ou « non » !", glyph: "🚫", family: "TURN_BASED", scoringEnabled: false, rounds: ROUNDS },
  { type: "MIME_PARTNER", name: "Mime ton partenaire", category: "FUN", tagline: "Imite sans rire, c'est mission impossible.", description: "Mime une habitude de ton/ta partenaire en appel vidéo. C'est lui/elle qui valide s'il/elle a deviné.", glyph: "🎬", family: "TURN_BASED", scoringEnabled: true, rounds: ROUNDS },
  { type: "COMPLIMENT_CHALLENGE", name: "Compliment Challenge", category: "ROMANTIC", tagline: "Tendre la parole en 24 cartes.", description: "Chaque tour, une raison de dire quelque chose de doux.", glyph: "💐", family: "TURN_BASED", scoringEnabled: true, rounds: ROUNDS },
  { type: "OUR_MEMORIES", name: "Nos souvenirs", category: "ROMANTIC", tagline: "Revisitez vos plus beaux moments.", description: "Souvenirs à raconter, précis ou flous. Chacun complète l'autre.", glyph: "📸", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "COMPLETE_THE_SENTENCE", name: "Complète ma phrase", category: "ROMANTIC", tagline: "« Depuis que je te connais… »", description: "Une phrase à terminer, deux fins possibles.", glyph: "✍️", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS },
  { type: "FIVE_THINGS", name: "5 choses que j'aime chez toi", category: "ROMANTIC", tagline: "Lâchez les compliments, un à cinq.", description: "Un thème, cinq choses à citer. L'exercice le plus simple qui existe.", glyph: "✦", family: "TURN_BASED", scoringEnabled: false, rounds: ROUNDS },
  { type: "DEEP_QUESTIONS", name: "Questions profondes", category: "PROFOND", tagline: "Passez de « quoi de neuf ? » à « qui es-tu ? »", description: "Les grandes questions qui font avancer un couple.", glyph: "🌌", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "OUR_DREAMS", name: "Nos rêves", category: "PROFOND", tagline: "Projets, ambitions, rêves d'enfant.", description: "Parlez de ce que vous voulez vraiment dans la vie.", glyph: "☁️", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "OUR_FUTURE", name: "Notre futur", category: "PROFOND", tagline: "Construire demain, ensemble.", description: "Vos envies à deux : voyage, maison, famille.", glyph: "🔮", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "OUR_VALUES", name: "Nos valeurs", category: "PROFOND", tagline: "Ce qui ne se négocie pas.", description: "Famille, argent, liberté, foi… alignez vos principes.", glyph: "🛡️", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "FLIRT_QUESTIONS", name: "Questions de flirt", category: "FLIRT", tagline: "La flamme, entretenue.", description: "Des questions canailles pour rallumer la tension.", glyph: "🔥", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "SEDUCTION_CHALLENGES", name: "Défis de séduction", category: "FLIRT", tagline: "Des petits gestes qui font fondre.", description: "Un défi sensuel par tour, à faire maintenant ou plus tard.", glyph: "🌶️", family: "TURN_BASED", scoringEnabled: false, rounds: ROUNDS },
  { type: "IMPOSSIBLE_CHOICE", name: "Choix impossible", category: "FLIRT", tagline: "Si tu devais choisir…", description: "Un dilemme tordu, deux issues.", glyph: "😈", family: "STANDARD", scoringEnabled: false, rounds: ROUNDS },
  { type: "COUPLE_QUESTIONS", name: "Questions de couple", category: "PROFOND", tagline: "Parler de vous, vraiment.", description: "Chacun son tour répond par écrit à une question sur votre couple ; l'autre valide quand la réponse le/la touche.", glyph: "💬", family: "TURN_BASED", scoringEnabled: false, rounds: { SOFT: 8, NORMAL: 10, INTENSE: 12 }, isNew: true },
  { type: "COUPLE_BATTLE", name: "Couple Battle", category: "COMPETITION", tagline: "Le duel du quotidien.", description: "Qui est le plus… ? Vous êtes d'accord = points.", glyph: "⚔️", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS },
  { type: "TIMED_QUIZ", name: "Quiz chronométré", category: "COMPETITION", tagline: "15 secondes par question, pas une de plus.", description: "Le chrono tourne : répondez avant la fin, soyez en phase. Le plus rapide des deux gagne un bonus.", glyph: "⏱️", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS, timerSeconds: 15 },
  { type: "SPEED_DUEL", name: "Duel de rapidité", category: "COMPETITION", tagline: "7 secondes. Celui qui hésite a perdu.", description: "Questions éclair « Qui de nous deux ? » : soyez d'accord et rapides, le plus vif empoche le bonus.", glyph: "🌩️", family: "STANDARD", scoringEnabled: true, rounds: ROUNDS, timerSeconds: 7 },
];

export function getCatalogEntry(type: GameType): GameCatalogEntry {
  return GAME_CATALOG.find((g) => g.type === type)!;
}

// ---- Favoris (localStorage) ----

const FAV_KEY = "niofar_favorites";

export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(type: string): string[] {
  const favs = getFavorites();
  const next = favs.includes(type) ? favs.filter((t) => t !== type) : [...favs, type];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

// ---- DeviceId (identité anonyme locale) ----

const DEVICE_KEY = "niofar_device";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}