import {
  PrismaClient,
  Difficulty as PrismaDifficulty,
  GameCategory as PrismaCategory,
  GameType as PrismaGameType,
} from "@prisma/client";
import { Category, Difficulty, GameType } from "../src/types";

const prisma = new PrismaClient();

const DIFFS: Difficulty[] = ["SOFT", "NORMAL", "INTENSE"];
const PER_DIFFICULTY = 15;

// ---------------------------------------------------------------------------
// Structure d'un jeu = "noyaux écrits à la main" + "variantes générées"
// (l'expansion pioche dans des banques thématiques pour garder du naturel).
// ---------------------------------------------------------------------------

interface CardTuple {
  content: string;
  options?: string[];
  type?: string; // override du type par défaut du jeu
}

interface GameSpec {
  gameType: GameType;
  category: Category;
  cardType: string; // "QUESTION" | "TRUTH" | "DARE" | "CHALLENGE" | "PROMPT"
  staticOptions?: string[];
  levels: Record<Difficulty, CardTuple[]>;
  gen?: {
    templates: (w: unknown, i: number) => CardTuple;
    bank: unknown[];
  };
}

function card(spec: GameSpec, diff: Difficulty, tuple: CardTuple, i: number) {
  return {
    gameType: spec.gameType as unknown as PrismaGameType,
    category: spec.category as unknown as PrismaCategory,
    difficulty: diff as unknown as PrismaDifficulty,
    type: tuple.type ?? spec.cardType,
    content: tuple.content,
    options: tuple.options ?? spec.staticOptions ?? [],
  };
}

/** Remplit les niveaux jusqu'à PER_DIFFICULTY puis renvoie tous les GameCard. */
function mint(spec: GameSpec, target = PER_DIFFICULTY): GameCardData[] {
  const out: GameCardData[] = [];
  for (const diff of DIFFS) {
    const base = spec.levels[diff] ?? [];
    base.slice(0, target).forEach((t, i) => out.push(card(spec, diff, t, i)));
    if (spec.gen) {
      let n = 0;
      while (out.filter((c) => c.difficulty === diff).length < target) {
        const t = spec.gen.templates(spec.gen.bank[n % spec.gen.bank.length], n);
        out.push(card(spec, diff, t, n));
        n++;
      }
    }
  }
  return out;
}

interface GameCardData {
  gameType: PrismaGameType;
  category: PrismaCategory;
  difficulty: PrismaDifficulty;
  type: string;
  content: string;
  options: string[];
}

// ---------------------------------------------------------------------------
// Containers partagés pour les banques de génération
// ---------------------------------------------------------------------------

const GEN_OPTIONS = [
  ["Le classique", "La nouveauté", "Le familier", "Autre chose"],
  ["Le plus souvent", "Dans les grands jours", "Jamais", "Par surprise"],
  ["Oui", "Non", "Ça dépend", "Peut-être"],
  ["Les deux", "Plutôt oui", "Plutôt non", "Nope"],
];

function withOptions(options: string[][]) {
  return (w: string, i: number) => ({
    content: w,
    options: options[i % options.length],
  });
}

// ---------------------------------------------------------------------------
// 1) CONNAISSANCE
// ---------------------------------------------------------------------------

const GUESS_ME: GameSpec = {
  gameType: "GUESS_ME",
  category: "CONNAISSANCE",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Quelle est ma couleur préférée ?", options: ["Rouge", "Bleu", "Vert", "Noir"] },
      { content: "Mon plat préféré sur la table du dimanche ?", options: ["Ce riz au poisson", "Mafé", "Pastels", "Yassa"] },
      { content: "Le genre de film que je préfère ?", options: ["Comédie", "Thriller", "Romance", "Action"] },
      { content: "Mon moment préféré de la journée ?", options: ["Le matin", "Après-midi", "Le soir", "La nuit"] },
      { content: "Ce que je bois le matin ?", options: ["Café", "Thé", "Bissap", "Eau chaude"] },
      { content: "Mon rêve de destination :", options: ["Paris", "Tokyo", "Marrakech", "New York"] },
      { content: "Le super-pouvoir que je voudrais :", options: ["Voler", "Téléportation", "Invisibilité", "Lire les pensées"] },
    ],
    NORMAL: [
      { content: "Ma saison préférée ?", options: ["Hivernage", "Saison sèche", "Fraîcheur", "Chaleur"] },
      { content: "Ce qui me détend le plus :", options: ["La musique", "Le sport", "Dormir", "Te parler"] },
      { content: "Mon chorotype : lève-tôt ou couche-tard ?", options: ["Lève-tôt", "Couche-tard", "Les deux", "Ni l'un ni l'autre"] },
      { content: "Le film que je peux revoir en boucle :", options: ["Une comédie", "Un Disney", "Un drame", "Une série"] },
      { content: "Ma priorité dans un budget :", options: ["Voyager", "Manger", "Habits", "Épargner"] },
      { content: "Le sport que je suivrais le plus :", options: ["Foot", "Basket", "Aucun", "Tennis"] },
      { content: "Mon style le dimanche matin :", options: ["Grasse matinée", "Tôt, ménage", "Sortie", "Série au lit"] },
    ],
    INTENSE: [
      { content: "Le souvenir d'enfance que je raconte le plus :", options: ["Vacances", "École", "Famille", "Jeux dehors"] },
      { content: "Ma plus grande peur :", options: ["Perdre les miens", "L'échec", "La solitude", "L'inconnu"] },
      { content: "Ce qui me ferait pleurer facilement :", options: ["Les films", "Les disputes", "Les retours", "L'injustice"] },
      { content: "Mon rêve inavoué :", options: ["Entreprendre", "Vivre ailleurs", "Écrire", "Chanter"] },
      { content: "La personne que j'admire le plus :", options: ["Ma mère", "Mon père", "Un mentor", "Toi"] },
      { content: "Ce dont je suis le plus fier/fière :", options: ["Ma famille", "Ce que j'ai construit", "Mes études", "Ma relation avec toi"] },
      { content: "Si je gagnais gros, je commencerais par :", options: ["Aider ma famille", "Investir", "Voyager", "T'en acheter un"] },
    ],
  },
  gen: {
    bank: [
      "la série que je regarderais avec toi",
      "la chanson que j'écoute en boucle",
      "l'endroit où je me sens en sécurité",
      "l'appli que je vérifie en premier le matin",
      "la glace que je commande au resto",
      "le plat que je mangeais petit",
      "la matière que j'adorais à l'école",
      "ce que je ferais avec toi demain",
      "le langage d'amour que je préfère",
    ],
    templates: withOptions(GEN_OPTIONS),
  },
};

const GUESS_MY_ANSWER: GameSpec = {
  gameType: "GUESS_MY_ANSWER",
  category: "CONNAISSANCE",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Sur ce qu'on commande ce soir, quelle est MA réponse ?", options: ["Resto", "À la maison", "Pizza", "Toi tu choisis"] },
      { content: "Que répondrais-je à : « sortie imprévue ce soir ? »", options: ["On y va", "Plutôt rester", "Ça dépend", "Propose une date"] },
      { content: "Mon budget mensuel approximatif pour le plaisir :", options: ["Rien", "Peu", "Moyen", "Trop 😅"] },
    ],
    NORMAL: [
      { content: "Ma réponse à : « on invite ta belle-famille samedi ? »", options: ["Avec plaisir", "Un autre jour", "Ok mais court", "Qu'y a-t-il à manger ?"] },
      { content: "Que dirais-je face à un vélo à offrir ?", options: ["Excellent cadeau", "Bof", "Je préfère autre chose", "Pour courir ensemble ?"] },
      { content: "Ma réponse à « on part en week-end sur un coup de tête ? »", options: ["Je prépare le sac", "Pas maintenant", "Où ça ?", "Laisse deviner"] },
    ],
    INTENSE: [
      { content: "Que répondrais-je à « on parle de notre avenir ce soir ? »", options: ["Avec plaisir", "Un peu stressé", "Rien à dire", "On en parle déjà"] },
      { content: "Ma réponse à « et si on déménageait ? »", options: ["Je suis partant", "Où ?", "Pas encore", "Construisons plutôt"] },
      { content: "Que répondrais-je à une offre d'emploi à l'étranger ?", options: ["On y va ensemble", "Reste", "Discutons", "Pas maintenant"] },
    ],
  },
  gen: {
    bank: [
      "un nouvel animal de compagnie",
      "des vacances en famille",
      "un mariage qui tombe le jour de notre anniversaire",
      "un déménagement l'été prochain",
      "une voiture neuve à choisir",
      "un régime à deux",
      "cours de danse à deux",
      "un credit pour un projet",
    ],
    templates: withOptions(GEN_OPTIONS),
  },
};

const WHO_KNOWS_BEST: GameSpec = {
  gameType: "WHO_KNOWS_BEST",
  category: "CONNAISSANCE",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Quel est mon anniversaire exactement ?", options: ["1er du mois", "Milieu du mois", "Fin du mois", "Je suis né un jour férié"] },
      { content: "Ma boisson préférée ?", options: ["Eau", "Café", "Thé", "Jus"] },
      { content: "Mon côté : mer ou montagne ?", options: ["Mer", "Montagne", "Les deux", "Ni l'un ni l'autre"] },
    ],
    NORMAL: [
      { content: "Ma plus longue relation avant la nôtre ?", options: ["Moins de 1 an", "1-2 ans", "2-5 ans", "Plus de 5 ans"] },
      { content: "Ce que je valorise le plus chez un ami :", options: ["La fiabilité", "L'humour", "L'écoute", "La franchise"] },
      { content: "Mon rituel du coucher :", options: ["Téléphone", "Livre", "Prière", "Rien, je m'endors"] },
    ],
    INTENSE: [
      { content: "Ce qui me rassure quand tout va mal :", options: ["Ta voix", "Ma famille", "Dormir", "Marcher"] },
      { content: "Ma définition du bonheur :", options: ["Être en paix", "Être avec toi", "Réussir", "Voyager"] },
      { content: "Ce que je ferais si tout était possible :", options: ["Entreprendre", "Écrire un livre", "Tourner le monde", "Passer du temps avec les miens"] },
    ],
  },
  gen: {
    bank: [
      "le secret que je garde depuis longtemps",
      "la petite habitude que j'ai du matin",
      "le mensonge le plus bénin que j'ai déjà dit",
      "la chose que j'oublie toujours",
      "le mot que j'emploie trop souvent",
      "la peur absurde que j'ai",
      "ce qui me force à sourire même en colère",
      "la chanson qui me rappelle mon enfance",
    ],
    templates: withOptions(GEN_OPTIONS),
  },
};

// ---------------------------------------------------------------------------
// 2) ACTION & VÉRITÉ
// ---------------------------------------------------------------------------

const TRUTH_CORE: CardTuple[] = [
  { content: "Quel est le mensonge le plus innocent que tu m'aies dit ?", type: "TRUTH" },
  { content: "Qu'est-ce qui t'a fait craquer pour moi au début ?", type: "TRUTH" },
  { content: "Le souvenir le plus embarrassant avec moi ?", type: "TRUTH" },
  { content: "Quelle est ta peur la plus ridicule ?", type: "TRUTH" },
  { content: "De quoi es-tu le plus fier/fière dans ta vie ?", type: "TRUTH" },
  { content: "Quelle habitude de moi tu aims le plus ?", type: "TRUTH" },
  { content: "Quelle habitude de moi tu changerais si tu pouvais ?", type: "TRUTH" },
];

const DARE_CORE: CardTuple[] = [
  { content: "Envoie-moi le message vocal le plus doux que tu puisses dire maintenant.", type: "DARE" },
  { content: "Imite ma façon de rire.", type: "DARE" },
  { content: "Rejoue ta déclaration de départ, comme au premier jour.", type: "DARE" },
  { content: "Danse 10 secondes sans musique, sans te vexer si je ris.", type: "DARE" },
  { content: "Fais-moi un compliment de la tête aux pieds.", type: "DARE" },
  { content: "Appelle-moi par trois surnoms différents, pas les habituels.", type: "DARE" },
  { content: "Raconte notre première rencontre de mon point de vue.", type: "DARE" },
];

const TRUTH_OR_DARE: GameSpec = {
  gameType: "TRUTH_OR_DARE",
  category: "ACTION_VERITE",
  cardType: "MIXED",
  levels: { SOFT: [], NORMAL: [], INTENSE: [] },
  gen: {
    bank: [
      ["Quel est ton plus grand secret que tu n'as jamais partagé ?", "Envoie-moi le message vocal le plus doux que tu peux dire maintenant."],
      ["Qu'est-ce qui t'a fait craquer pour moi au tout début ?", "Imite ma façon de rire."],
      ["Quel est ton plus grand regret amoureux avant moi ?", "Danse 10 secondes sans musique, sans te vexer si je ris."],
      ["Quelle est la chose que tu n'oses jamais me dire ?", "Rejoue la scène de notre rencontre, sans te tromper."],
      ["De quoi es-tu le plus fier/fière dans ta vie ?", "Fais-moi trois compliments différents."],
      ["Quelle est ta peur la plus ridicule ?", "Mime ta journée d'hier, de A à Z."],
      ["Quel est le tout petit plaisir dont tu ne parles jamais ?", "Trouve un surnom nouveau pour moi."],
      ["Quelle est la plus belle preuve d'amour que tu as déjà offerte ?", "Chante les 10 premières secondes de notre chanson."],
      ["Qu'est-ce que tu m'as pardonné sans jamais le dire ?", "Ordonne-moi un service à exécuter ce soir."],
      ["Qu'est-ce qui te rendrait plus heureux/heureuse demain, si je le savais ?", "Fais une petite surprise à moi-même pour un souvenir."],
      ["Le détail de moi que tu remarques en premier ?", "Raconte ton pire fou rire."],
      ["Quel est le rêve que tu n'as jamais osé formuler ?", "Fais semblant d'être moi pendant 30 secondes."],
    ],
    templates: (item: unknown, i: number) => {
      const [truth, dare] = item as [string, string];
      return i % 2 === 0
        ? { content: truth, type: "TRUTH" }
        : { content: dare, type: "DARE" };
    },
  },
};

const TRUTH_GAME: GameSpec = {
  gameType: "TRUTH",
  category: "ACTION_VERITE",
  cardType: "TRUTH",
  levels: { SOFT: TRUTH_CORE, NORMAL: TRUTH_CORE, INTENSE: TRUTH_CORE },
  gen: {
    bank: [
      "Quel est ton plus grand secret que tu n'as jamais partagé ?",
      "Quelle est ta plus grosse peur du couple ?",
      "Quelle question aimerais-tu que je te pose enfin ?",
      "Quelle est la chose la plus impulsive que tu aies faite ?",
      "Quel est le rêve que tu n'oses pas encore formuler ?",
      "Quel est ton plus grand moment de fierté secret ?",
      "Quelle est ta plus grande épreuve traversée ?",
      "Qu'e qui t'a le plus blessé(e) dans ta vie ?",
      "Quel est ton plus beau souvenir d'enfance ?",
    ],
    templates: (w: string) => ({ content: w, type: "TRUTH" }),
  },
};

const DARE_GAME: GameSpec = {
  gameType: "DARE",
  category: "ACTION_VERITE",
  cardType: "DARE",
  levels: { SOFT: DARE_CORE, NORMAL: DARE_CORE, INTENSE: DARE_CORE },
  gen: {
    bank: [
      "Chante les 10 premières secondes de notre chanson.",
      "Mime ta journée d'hier de A à Z.",
      "Fais trois tours sur toi-même et dis-moi qui je suis.",
      "Envoie-moi la meilleure photo de toi et explique-la.",
      "Rends-moi un service que je peux demander dans 24h.",
      "Raconte ton pire fou rire.",
      "Fais semblant d'être moi pendant 30 secondes.",
      "Invente la suite de notre histoire à voix haute.",
      "Dis-moi trois choses que tu aimes chez toi.",
    ],
    templates: (w: string) => ({ content: w, type: "DARE" }),
  },
};

// ---------------------------------------------------------------------------
// 3) FUN
// ---------------------------------------------------------------------------

const WHO_IS_MORE: GameSpec = {
  gameType: "WHO_IS_MORE",
  category: "FUN",
  cardType: "QUESTION",
  staticOptions: ["MOI", "MON PARTENAIRE"],
  levels: {
    SOFT: [
      { content: "Qui râle le plus ?" },
      { content: "Qui est le plus gourmand ?" },
      { content: "Qui choisit toujours le film ?" },
      { content: "Qui dort le plus longtemps ?" },
      { content: "Qui rit le plus fort ?" },
      { content: "Qui est le plus souvent en retard ?" },
    ],
    NORMAL: [
      { content: "Qui cuisine le mieux quand il/elle veut ?" },
      { content: "Qui est le plus jaloux/jalouse ?" },
      { content: "Qui dépense le plus d'argent ?" },
      { content: "Qui pardonne le plus vite ?" },
      { content: "Qui tient le plus de place dans le lit ?" },
      { content: "Qui a le réveil le plus difficile ?" },
    ],
    INTENSE: [
      { content: "Qui prend les décisions importantes du couple ?" },
      { content: "Qui est le plus émotif en secret ?" },
      { content: "Qui a le plus de mal à dire pardon ?" },
      { content: "Qui rêve le plus grand ?" },
      { content: "Qui s'inquiète le plus pour l'autre ?" },
      { content: "Qui est le plus têtu/têtue ?" },
    ],
  },
  gen: {
    bank: [
      "se lever tôt le week-end",
      "perdre les clés",
      "mettre la musique trop fort",
      "laisser traîner ses affaires",
      "passer la soirée sur le téléphone",
      "dormir pendant un film",
      "vouloir le dernier mot",
      "se plaindre du froid",
      "être prêt/prête en avance",
    ],
    templates: (w: string) => ({ content: `Qui de nous deux ${w} ?` }),
  },
};

const WOULD_YOU_RATHER: GameSpec = {
  gameType: "WOULD_YOU_RATHER",
  category: "FUN",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Tu préfères… rester au lit ou te promener au bord de l'eau ?", options: ["Rester au lit", "Promenade au bord de l'eau"] },
      { content: "Tu préfères… un gâteau fait maison ou un dîner surprise ?", options: ["Gâteau fait maison", "Dîner surprise"] },
      { content: "Tu préfères… un week-end à la mer ou à la montagne ?", options: ["À la mer", "À la montagne"] },
      { content: "Tu préfères… gagner au jeu ou recevoir un cadeau de moi ?", options: ["Gagner au jeu", "Recevoir un cadeau de toi"] },
    ],
    NORMAL: [
      { content: "Tu préfères… ne plus jamais avoir faim ou ne plus jamais être fatigué(e) ?", options: ["Ne plus jamais avoir faim", "Ne plus jamais être fatigué(e)"] },
      { content: "Tu préfères… une vie de voyage ou une vie bien ancrée chez soi ?", options: ["Toujours voyager", "Être bien ancré(e) chez moi"] },
      { content: "Tu préfères… parler en public ou prendre tout le monde en photo ?", options: ["Parler en public", "Photographier tout le monde"] },
      { content: "Tu préfères… manger épicé toute ta vie ou doux toute ta vie ?", options: ["Épicé", "Doux"] },
    ],
    INTENSE: [
      { content: "Tu préfères… savoir ce que tout le monde pense de toi ou pouvoir voler ?", options: ["Savoir ce qu'on pense de moi", "Pouvoir voler"] },
      { content: "Tu préfères… vivre 100 ans seul ou 50 ans avec moi ?", options: ["100 ans seul", "50 ans avec toi"] },
      { content: "Tu préfères… perdre tous tes souvenirs ou ne plus jamais rêver ?", options: ["Perdre mes souvenirs", "Ne plus jamais rêver"] },
      { content: "Tu préfères… être très riche mais oublié(e), ou être aimé(e) sans argent ?", options: ["Riche mais oublié(e)", "Aimé(e) sans argent"] },
    ],
  },
  gen: {
    bank: [
      "un dîner en tête-à-tête chaque mois",
      "un voyage surprise chaque année",
      "des sorties culturelles à deux",
    ],
    templates: (w: string) => {
      const options = ["Oui", "Non, l'autre option"];
      return { content: `Tu préfères… ${w} ou l'inverse ?`, options };
    },
  },
};

const NO_YES_NO: GameSpec = {
  gameType: "NO_YES_NO",
  category: "FUN",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Tu aimes le chocolat ?" },
      { content: "Tu as déjà menti en jouant à un jeu ?" },
      { content: "Tu préfères le thé au café ?" },
      { content: "Tu as déjà rêvé de moi avant nous ?" },
    ],
    NORMAL: [
      { content: "Tu voudras toujours vivre dans le même pays que moi ?" },
      { content: "Tu penses que le couple moderne doit partager les tâches à moitié ?" },
      { content: "Tu as déjà caché un achat à ton partenaire ?" },
      { content: "Tu voudrais un engagement plus grand ?" },
    ],
    INTENSE: [
      { content: "Tu as déjà eu peur de vraiment m'aimer ?" },
      { content: "Tu penses parfois à fonder une famille avec moi ?" },
      { content: "Tu as des regrets dans notre histoire ?" },
      { content: "Tu t'imagines vieux/vieille à mes côtés ?" },
    ],
  },
  gen: {
    bank: [
      "Tu as déjà fait semblant d'être occupé(e) pour éviter un appel ?",
      "Tu aimes mes amis ?",
      "Tu réfléchis avant de parler ?",
      "Tu préfères les surprises ?",
      "Tu as déjà eu un coup de cœur pour un inconnu ?",
      "Tu voudrais un animal de compagnie ?",
      "Tu aimes danser ?",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

const MIME_PARTNER: GameSpec = {
  gameType: "MIME_PARTNER",
  category: "FUN",
  cardType: "CHALLENGE",
  levels: {
    SOFT: [
      { content: "Mime comment ton/ta partenaire dit bonjour au téléphone." },
      { content: "Mime comment ton/ta partenaire réagit à une bonne nouvelle." },
      { content: "Mime ta propre façon de t'asseoir dans le canapé." },
      { content: "Mime comment ton/ta partenaire mange son plat préféré." },
    ],
    NORMAL: [
      { content: "Mime ton/ta partenaire en train de se plaindre du froid." },
      { content: "Mime ton/ta partenaire qui réveille tout le monde un matin." },
      { content: "Mime ton/ta partenaire en réunion (tolérance: sans dire un mot)." },
      { content: "Mime ta propre danse quand tu es seul(e) dans la cuisine." },
    ],
    INTENSE: [
      { content: "Mime ton/ta partenaire en train de dire non à quelque chose." },
      { content: "Mime ton/ta partenaire jaloux/jalouse (scène courte)." },
      { content: "Mime ton/ta partenaire qui se recoiffe avant de sortir." },
      { content: "Mime ton/ta partenaire en train de s'endormir." },
    ],
  },
  gen: {
    bank: [
      "à la plage",
      "en attendant son repas",
      "au réveil",
      "en disant « je t'aime »",
    ],
    templates: (w: string) => ({ content: `Mime ton/ta partenaire ${w}.` }),
  },
};

// ---------------------------------------------------------------------------
// 4) ROMANTIQUE
// ---------------------------------------------------------------------------

const COMPLIMENT_CHALLENGE: GameSpec = {
  gameType: "COMPLIMENT_CHALLENGE",
  category: "ROMANTIC",
  cardType: "CHALLENGE",
  levels: {
    SOFT: [
      { content: "Complimente ton/ta partenaire sur son sourire, en 3 mots." },
      { content: "Trouve un compliment venant de cette journée : un détail qui t'a plu." },
      { content: "Complimente ton/ta partenaire sur sa voix." },
      { content: "Complimente-toi le regard dans le sien." },
    ],
    NORMAL: [
      { content: "Cite une qualité que tu découvres encore chez lui/elle." },
      { content: "Complimente ton/ta partenaire sur une force de caractère." },
      { content: "Trouve un compliment sur son humour ou son intelligence." },
      { content: "Complimente ton/ta partenaire sur un détail physique précis (cheveux, mains…)." },
    ],
    INTENSE: [
      { content: "Décris en une phrase pourquoi tu es fier/fière de lui/elle." },
      { content: "Complimente ton/ta partenaire sur la manière dont il/elle gère les conflits." },
      { content: "Lui dire la chose que tu n'oserais jamais dire aux autres." },
      { content: "Complimente ton/ta partenaire sur sa façon de t'aimer." },
    ],
  },
  gen: {
    bank: [
      "Envoie un message vocal qui lui détaille trois choses appréciées.",
      "Dis-lui le compliment que tu recois rarement.",
      "Compliment avec un clin d'œil sur ses yeux.",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

const OUR_MEMORIES: GameSpec = {
  gameType: "OUR_MEMORIES",
  category: "ROMANTIC",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Notre tout premier rendez-vous : chacun raconte sa version." },
      { content: "Le premier cadeau que tu m'as offert : comment tu l'as choisi ?" },
      { content: "Le moment où je t'ai dit « je t'aime » pour la première fois : raconte-le." },
      { content: "Notre premier séjour à deux : qu'est-ce qui a été le plus drôle ?" },
    ],
    NORMAL: [
      { content: "Le moment où nous avons éclaté de rire alors qu'on aurait juré ne pas pouvoir." },
      { content: "La plus belle preuve d'amour qu'on m'ait donnée, de toi : raconte." },
      { content: "Le premier voyage, la première dispute, la première réconciliation : choisis-en un." },
      { content: "Le détail de notre histoire que personne d'autre ne connaît." },
    ],
    INTENSE: [
      { content: "Le moment où j'ai su que c'était toi : raconte-le-moi." },
      { content: "L'épreuve que nous avons traversée ensemble et qui nous a rapprochés." },
      { content: "Le souvenir où tu t'es senti(e) le plus compris(e) par moi." },
      { content: "Si nous n'étions jamais rencontrés : à quoi ressemblerait ta vie ?" },
    ],
  },
  gen: {
    bank: [
      "un week-end improvisé",
      "une grande déclaration",
      "un fou rire inoubliable",
      "une annonce à la famille",
    ],
    templates: (w: string) => ({ content: `Évoque avec nous le souvenir de ${w}.` }),
  },
};

const COMPLETE_THE_SENTENCE: GameSpec = {
  gameType: "COMPLETE_THE_SENTENCE",
  category: "ROMANTIC",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Depuis que je te connais, je…", options: ["Ris plus", "Dors moins", "Rêve plus", "Suis plus réveillé(e)"] },
      { content: "Grâce à toi, je me sens…", options: ["Compris(e)", "Soutenu(e)", "Léger/légère", "Poussé(e)"] },
      { content: "Avec toi, le dimanche est…", options: ["Reposant", "Aventureux", "Télé", "Un grand jour"] },
    ],
    NORMAL: [
      { content: "Ce que j'aime chez toi, en premier…", options: ["Ta loyauté", "Ton humour", "Ta douceur", "Ton regard"] },
      { content: "Toi et moi, on devrait…", options: ["Plus sortir", "Épargner à deux", "Planifier l'été", "Essayer un nouveau jeu"] },
      { content: "Quand je ne suis pas avec toi, je…", options: ["Tiens bon", "Pense à nous", "Travaille", "Prépare des surprises"] },
    ],
    INTENSE: [
      { content: "La plus belle preuve d'amour que tu m'as donnée…", options: ["Ta patience", "Ta présence", "Tes efforts", "Ta confiance"] },
      { content: "Si on se perdait, je…", options: ["Te retrouverais", "Te laisserais vivre", "T'attendrais", "T'écrirais"] },
      { content: "Ce que je n'ose dire qu'à toi…", options: ["Mes doutes", "Mes rêves", "Mes secrets", "Tout ce que tu sais déjà"] },
    ],
  },
  gen: {
    bank: [
      "« Un week-end réussi, c'est… »",
      "« Mon plus grand compliment secret, c'est… »",
      "« Le soir, je préfère… »",
    ],
    templates: (w: string) => {
      const base = ["…", "tout ce que tu as dit", "l'inverse", "le reste"];
      return { content: w, options: base };
    },
  },
};

const FIVE_THINGS: GameSpec = {
  gameType: "FIVE_THINGS",
  category: "ROMANTIC",
  cardType: "CHALLENGE",
  levels: {
    SOFT: [
      { content: "Cite 5 choses que tu aimes chez moi (ça ne coûte rien de se le dire)." },
      { content: "Cite 5 de mes habitudes qui te font sourire." },
      { content: "Cite 5 endroits où tu m'imagines avec toi." },
    ],
    NORMAL: [
      { content: "Cite 5 souvenirs qui me feraient rire et que je peux raconter." },
      { content: "Cite 5 choses que tu veux m'apprendre," },
      { content: "Cite 5 forces que tu reconnais chez moi." },
    ],
    INTENSE: [
      { content: "Cite 5 raisons de rester avec moi, sans hésiter." },
      { content: "Cite 5 futurs rêves où je suis dedans." },
      { content: "Cite 5 choses que tu m'as pardonnées et pourquoi tu as choisi de continuer." },
    ],
  },
  gen: {
    bank: [
      "5 instants de cette semaine qui valaient le coup",
      "5 choses qui te rendent fier/fière de toi",
      "5 envies pour l'année prochaine",
      "5 grands rires partagés",
    ],
    templates: (w: string) => ({ content: `Cite ${w}.` }),
  },
};

// ---------------------------------------------------------------------------
// 5) PROFOND
// ---------------------------------------------------------------------------

const DEEP_QUESTIONS: GameSpec = {
  gameType: "DEEP_QUESTIONS",
  category: "PROFOND",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Qu'est-ce qui t'a rendu(e) heureux/heureuse cette semaine, en vrai ?" },
      { content: "Quelle est la chose que tu n'as pas eu le temps de me raconter ?" },
      { content: "Quel est le rêve que tu as eu récemment ?" },
    ],
    NORMAL: [
      { content: "Quelle est ta plus grande peur en ce moment, sans te brider ?" },
      { content: "Qu'est-ce que tu ferais différemment dans ta vie si tu pouvais recommencer ?" },
      { content: "Qu'est-ce que l'argent représente pour toi, honnêtement ?" },
    ],
    INTENSE: [
      { content: "Qu'est-ce qui te manque le plus aujourd'hui, dans ta vie ?" },
      { content: "Es-tu en train de vivre la vie que tu imaginais à 18 ans ?" },
      { content: "Qu'est-ce que tu voudrais que je rencontre en premier : tes doutes ou tes joies ?" },
    ],
  },
  gen: {
    bank: [
      "Dans 10 ans, que voudrais-tu avoir construit ?",
      "Quelle leçon de ta famille gardes-tu pour nous ?",
      "Quel mot définit le mieux ton enfance ?",
      "Si tu ne pouvais garder qu'une seule chose de moi, ce serait quoi ?",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

const OUR_DREAMS: GameSpec = {
  gameType: "OUR_DREAMS",
  category: "PROFOND",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Où t'imagines-tu dans 5 ans, projet le plus concret ?" },
      { content: "Si tu pouvais exercer n'importe quel métier, sans contrainte ?" },
      { content: "Quelle est la première chose à rayer de ta bucket list ?" },
      { content: "Un voyage à faire coûte que coûte ?" },
    ],
    NORMAL: [
      { content: "Quel est le rêve que tu n'oses pas dire tout haut, et pourquoi ?" },
      { content: "Entre stabilité et aventure, ce que tu choisis vraiment ?" },
      { content: "Le rêve d'enfant que tu n'as jamais abandonné." },
      { content: "Si tu savais que tu ne peux pas échouer, tu ferais quoi ?" },
    ],
    INTENSE: [
      { content: "Qu'est-ce qui t'empêche, encore, de poursuivre ton rêve ?" },
      { content: "Quel rêve voudrais-tu que nous construisions à deux avant nos 50 ans ?" },
      { content: "Si notre vie était un livre, quel titre voudrais-tu ?" },
      { content: "As-tu renoncé à un rêve pour nous ? Raconte." },
    ],
  },
  gen: {
    bank: [
      "Un rêve de maison ?",
      "Un rêve de mode de vie ?",
      "Un rêve de famille ?",
      "Un rêve de carrière ?",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

const OUR_FUTURE: GameSpec = {
  gameType: "OUR_FUTURE",
  category: "PROFOND",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Pour nous deux, la ville idéale ?" },
      { content: "Avant de nous engager plus : quelle est ta vision du quotidien à deux ?" },
      { content: "Le premier projet du couple que tu aimerais lancer ?" },
      { content: "Week-end idéal dans 3 ans ?" },
    ],
    NORMAL: [
      { content: "Quel est notre plus grand défi prévu pour l'an prochain ?" },
      { content: "Comment imagines-tu nos finances à deux ?" },
      { content: "Quelle habitude voudrais-tu qu'on prenne ensemble cette année ?" },
      { content: "Où veux-tu qu'on soit dans 5 ans, concrètement ?" },
    ],
    INTENSE: [
      { content: "Es-tu prêt(e) à aligner nos rythmes de vie ?" },
      { content: "Le projet qui t'effraie le plus quand on l'évoque à deux ?" },
      { content: "Qu'est-ce qui devrait changer pour que tu te sentes vraiment « nous » ?" },
      { content: "Si tu avais un conseil pour notre couple, doué à toi-même dans 10 ans ?" },
    ],
  },
  gen: {
    bank: [
      "Dans notre futur, ta place à moi ?",
      "L'organisation de la maison dans 5 ans ?",
      "Les grandes vacances dans 5 ans ?",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

const OUR_VALUES: GameSpec = {
  gameType: "OUR_VALUES",
  category: "PROFOND",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "La valeur que tu ne négocierais jamais ?" },
      { content: "Ce que l'honnêteté représente pour toi dans notre couple ?" },
      { content: "La place de la famille dans nos choix ?" },
      { content: "La valeur que tu admires le plus chez l'autre ?" },
    ],
    NORMAL: [
      { content: "Comment gères-tu la colère : par l'expression ou le silence ?" },
      { content: "L'argent : ton rapport, ton histoire ?" },
      { content: "Qu'est-ce que la fidélité veut dire pour toi, au fond ?" },
      { content: "La valeur qui a guidé ton choix de vie le plus important ?" },
    ],
    INTENSE: [
      { content: "Qu'est-ce qui te mettrait en conflit profond avec moi, même en t'aimant ?" },
      { content: "Une valeur que tu aimerais que j'adopte, et pourquoi ?" },
      { content: "Crois-tu qu'un couple doit tout partager, ou garder des parts de soi ?" },
      { content: "Quelle serait selon toi notre plus grand désaccord potentiel ?" },
    ],
  },
  gen: {
    bank: [
      "La liberté personnelle dans une vie à deux ?",
      "La place de la religion dans nos choix ?",
      "L'importance de la justice dans nos décisions ?",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

// ---------------------------------------------------------------------------
// 6) FLIRT
// ---------------------------------------------------------------------------

const FLIRT_QUESTIONS: GameSpec = {
  gameType: "FLIRT_QUESTIONS",
  category: "FLIRT",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Quel compliment a le plus d'effet sur toi ?" },
      { content: "Le détail qui t'attire d'abord chez quelqu'un ?" },
      { content: "Le lieu où tu aimerais qu'on se retrouve en secret ?" },
      { content: "Quel est ton signe d'attention préféré ?" },
    ],
    NORMAL: [
      { content: "Le souvenir le plus sensuel de notre couple ?" },
      { content: "Qu'est-ce qui t'excite le plus chez moi, dis-le franchement ?" },
      { content: "Ta façon préférée de flirter avec moi ?" },
      { content: "Le vêtement que tu préfères me voir porter ?" },
    ],
    INTENSE: [
      { content: "Quelle est ta plus grande fantaisie à propos de nous ?" },
      { content: "Le moment où tu as eu le plus chaud rien qu'en me regardant ?" },
      { content: "Qu'est-ce qui ferait fondre toute ta défense en un instant ?" },
    ],
  },
  gen: {
    bank: [
      "Le baiser parfait, pour toi, c'est… ?",
      "Quel endroit de nous deux t'attire encore aujourd'hui ?",
      "Une nouvelle chose à tenter avec moi ?",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

const SEDUCTION_CHALLENGES: GameSpec = {
  gameType: "SEDUCTION_CHALLENGES",
  category: "FLIRT",
  cardType: "CHALLENGE",
  levels: {
    SOFT: [
      { content: "Lui dire à l'oreille ce que tu apprécies de lui/elle aujourd'hui." },
      { content: "Un compliment physique, sincère, de la tête aux pieds." },
      { content: "Un clin d'œil et un sourire : attention, ça compte pour deux." },
      { content: "Lui laisser un petit billet doux discret." },
    ],
    NORMAL: [
      { content: "Raconte-lui un souvenir où tu as eu un faible pour lui/elle." },
      { content: "Invite-le/la imaginairement à un rendez-vous sexy, sans dévoiler tout." },
      { content: "Fais-le/la rire avec votre blague secrète à deux." },
      { content: "Propose un moment calme à deux en fin de soirée." },
    ],
    INTENSE: [
      { content: "Décris ce qui te fait craquer chez lui/elle aujourd'hui, en détail." },
      { content: "Chuchote-lui ce que tu ferais si nous étions seuls." },
      { content: "Prends sa main et garde-la dans la tienne tout le tour suivant." },
    ],
  },
  gen: {
    bank: [
      "Un regard appuyé, 3 secondes, sans ciller.",
      "Remercie-le/la avec un geste tendre au bout d'un moment.",
      "Un « tu sens bon » en passant.",
    ],
    templates: (w: string) => ({ content: w }),
  },
};

const IMPOSSIBLE_CHOICE: GameSpec = {
  gameType: "IMPOSSIBLE_CHOICE",
  category: "FLIRT",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Si tu devais choisir : gagner la lune ou toute la sagesse du monde ?", options: ["La lune", "La sagesse"] },
      { content: "Un bisou pour toujours ou un fou rire pour toujours ?", options: ["Bisou éternel", "Fou rire éternel"] },
      { content: "Connaître mon passé ou mon futur ?", options: ["Ton passé", "Ton futur"] },
      { content: "Être en tenue de gala ou en pyjama pour le reste de ma vie ?", options: ["Toujours en gala", "Toujours en pyjama"] },
    ],
    NORMAL: [
      { content: "Si tu devais choisir : ne plus jamais t'ennuyer ou ne plus jamais avoir honte ?", options: ["Jamais m'ennuyer", "Jamais avoir honte"] },
      { content: "Me voir tous les jours mais ne plus me toucher, ou m'embrasser une fois par an ?", options: ["Le voir tous les jours", "L'embrasser une fois par an"] },
      { content: "Partir en voyage sans moi ou rester mais sans projets avec moi ?", options: ["Voyager sans lui/elle", "Rester sans projets"] },
      { content: "Tomber amoureux à chaque rencontre ou ne plus jamais ressentir de coup de cœur ?", options: ["Amoureux souvent", "Plus de coup de cœur"] },
    ],
    INTENSE: [
      { content: "Si tu devais perdre une chose : la mémoire de tout ce qu'on a vécu, ou la mémoire de tout ce que j'ai dit ?", options: ["Oublier nos moments", "Oublier tes paroles"] },
      { content: "Faire le premier pas avec moi pour toujours, ou ne jamais le faire mais rester ensemble ?", options: ["Toujours le premier pas", "Jamais le premier pas"] },
      { content: "Vivre dans l'instant, tout le temps, ou planifier notre vie comme un projet ?", options: ["Vivre l'instant", "Tout planifier"] },
      { content: "Si j'étais un secret : le partager ou le garder pour toujours ?", options: ["Le partager", "Le garder"] },
    ],
  },
  gen: {
    bank: [
      "Le calme absolu ou le tumulte des passions",
      "Toujours avoir raison ou toujours être aimé(e)",
      "Ne jamais être critiqué(e) ou ne jamais être comparé(e)",
    ],
    templates: (w: string) => {
      const options = ["Option A", "Option B"];
      return { content: `Dois choisir : ${w} ?`, options };
    },
  },
};

// ---------------------------------------------------------------------------
// 7) COMPÉTITION
// ---------------------------------------------------------------------------

const COUPLE_BATTLE: GameSpec = {
  gameType: "COUPLE_BATTLE",
  category: "COMPETITION",
  cardType: "QUESTION",
  staticOptions: ["MOI", "MON PARTENAIRE"],
  levels: {
    SOFT: [
      { content: "Qui cuisine le mieux ?" },
      { content: "Qui arrive en retard le plus souvent ?" },
      { content: "Qui est le plus radin avec les friandises ?" },
      { content: "Qui se lève facilement le matin ?" },
    ],
    NORMAL: [
      { content: "Qui dépense le plus d'argent ?" },
      { content: "Qui pardonne le plus vite ?" },
      { content: "Qui prend les décisions dans le couple ?" },
      { content: "Qui est le plus organisé/organisée ?" },
      { content: "Qui gère le mieux les imprévus ?" },
    ],
    INTENSE: [
      { content: "Qui a le plus de caractère ?" },
      { content: "Qui est le plus impulsif/impulsive ?" },
      { content: "Qui pourrait survivre plus longtemps en mode survie ?" },
      { content: "Qui a le plus d'influence sur l'autre ?" },
      { content: "Qui ment mieux en jouant au poker (si on jouait) ?" },
    ],
  },
  gen: {
    bank: [
      "perdre les clés",
      "mettre la musique trop fort",
      "passer la soirée au téléphone",
      "être prêt/prête en avance",
      "demander le menu complet",
    ],
    templates: (w: string) => ({ content: `Qui est le plus susceptible de ${w} ?` }),
  },
};

const TIMED_QUIZ: GameSpec = {
  gameType: "TIMED_QUIZ",
  category: "COMPETITION",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Vrai ou faux : le week-end est notre plus grande invention.", options: ["Vrai", "Faux"] },
      { content: "Quel est mon plat préféré, vous avez 5 secondes.", options: ["Thiéboudienne", "Yassa", "Mafé", "Pastels"] },
      { content: "Le film que je choisirais sans réfléchir :", options: ["Comédie", "Thriller", "Romance", "Action"] },
    ],
    NORMAL: [
      { content: "Il est … heures passées : quel est le bon ?", options: ["l'heure du thé", "l'heure du conte", "l'heure de dormir", "l'heure du jeu"] },
      { content: "Notre chanson préférée commence par…", options: ["un refrain doux", "une intro instrumentale", "un silence", "un cri de joie"] },
      { content: "Le mot que tu dis le plus :", options: ["En fait", "Franchement", "Peu importe", "Alors"] },
    ],
    INTENSE: [
      { content: "Qui a dit la première blague du couple ?", options: ["Moi", "Toi", "Personne", "Les deux"] },
      { content: "Notre premier fait marquant de l'an dernier :", options: ["Un voyage", "Un projet", "Un déménagement", "Une dispute"] },
      { content: "Le chiffre porte-bonheur du couple :", options: ["notre rencontre", "notre anniversaire", "le jour du mois", "aucun, par principe"] },
    ],
  },
  gen: {
    bank: [
      "Le mot secret de notre couple ?",
      "La gifle cérébrale : réponds en 3 secondes.",
      "Rapidité : le prénom du plat préféré de l'autre ?",
    ],
    templates: (w: string) => ({ content: w, options: ["Oui", "Non", "Peut-être", "Aucun"] }),
  },
};

const SPEED_DUEL: GameSpec = {
  gameType: "SPEED_DUEL",
  category: "COMPETITION",
  cardType: "QUESTION",
  levels: {
    SOFT: [
      { content: "Qui sourit le plus dans la rue ?", options: ["MOI", "MON PARTENAIRE"] },
      { content: "Qui marche le plus vite ?", options: ["MOI", "MON PARTENAIRE"] },
      { content: "Qui parle le plus ?", options: ["MOI", "MON PARTENAIRE"] },
    ],
    NORMAL: [
      { content: "Qui regarde le plus d'écran ?", options: ["MOI", "MON PARTENAIRE"] },
      { content: "Qui a le plus de mots dans le vocabulaire du couple ?", options: ["MOI", "MON PARTENAIRE"] },
      { content: "Qui prépare le mieux les anniversaires ?", options: ["MOI", "MON PARTENAIRE"] },
    ],
    INTENSE: [
      { content: "Qui décide le plus souvent où aller ?", options: ["MOI", "MON PARTENAIRE"] },
      { content: "Qui ferme le plus souvent la conversation ?", options: ["MOI", "MON PARTENAIRE"] },
      { content: "Qui a le plus de patience dans la file d'attente ?", options: ["MOI", "MON PARTENAIRE"] },
    ],
  },
  gen: {
    bank: [
      "regarder la météo chaque matin",
      "arriver le dernier",
      "commander le même plat",
      "dire que tout va bien alors que non",
    ],
    templates: (w: string) => ({ content: `Qui de nous deux est le plus susceptible de ${w} ?` }),
  },
};

// ---------------------------------------------------------------------------

const ALL_SPECS: GameSpec[] = [
  GUESS_ME,
  GUESS_MY_ANSWER,
  WHO_KNOWS_BEST,
  TRUTH_OR_DARE,
  TRUTH_GAME,
  DARE_GAME,
  WHO_IS_MORE,
  WOULD_YOU_RATHER,
  NO_YES_NO,
  MIME_PARTNER,
  COMPLIMENT_CHALLENGE,
  OUR_MEMORIES,
  COMPLETE_THE_SENTENCE,
  FIVE_THINGS,
  DEEP_QUESTIONS,
  OUR_DREAMS,
  OUR_FUTURE,
  OUR_VALUES,
  FLIRT_QUESTIONS,
  SEDUCTION_CHALLENGES,
  IMPOSSIBLE_CHOICE,
  COUPLE_BATTLE,
  TIMED_QUIZ,
  SPEED_DUEL,
];

async function main() {
  console.log("Nettoyage du contenu…");
  await prisma.answer.deleteMany();
  await prisma.gameCard.deleteMany();

  const rows: GameCardData[] = [];
  for (const spec of ALL_SPECS) {
    rows.push(...mint(spec));
  }

  // Filtrer les doublons de contenu au sein d'un même (gameType, difficulty)
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = `${r.gameType}|${r.difficulty}|${r.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await prisma.gameCard.createMany({ data: unique });
  const byGame = new Map<string, number>();
  for (const r of unique) byGame.set(r.gameType, (byGame.get(r.gameType) ?? 0) + 1);

  console.log(`Seed terminé : ${unique.length} cartes, ${ALL_SPECS.length} jeux.`);
  for (const [game, n] of [...byGame.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  · ${game}: ${n}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });