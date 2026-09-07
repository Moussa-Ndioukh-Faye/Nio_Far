import { PrismaClient, GameType, ChallengeType } from "@prisma/client";

const prisma = new PrismaClient();

// --- 50 questions "À quel point tu me connais ?" ---
// Chaque question a 3-4 options. Génération semi-procédurale à partir de
// thèmes variés pour couvrir les 50 rapidement, avec un noyau de questions
// "signature" écrites à la main.
const guessMeCore: { prompt: string; options: string[] }[] = [
  { prompt: "Quelle destination aimerais-je visiter avec toi ?", options: ["🇫🇷 Paris", "🇲🇦 Marrakech", "🇯🇵 Tokyo", "🇮🇹 Rome"] },
  { prompt: "Quelle est ma ville préférée ?", options: ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor"] },
  { prompt: "Quel est mon plat préféré ?", options: ["Thiéboudienne", "Yassa poulet", "Mafé", "Pastels"] },
  { prompt: "Quelle est ma saison préférée ?", options: ["Hivernage", "Saison sèche", "Harmattan", "Peu importe"] },
  { prompt: "Quel super-pouvoir je choisirais ?", options: ["Voler", "Téléportation", "Invisibilité", "Lire dans les pensées"] },
  { prompt: "Quel film je reverrais sans me lasser ?", options: ["Une comédie", "Un thriller", "Une romance", "Un film d'action"] },
  { prompt: "Comment je préfère passer un dimanche ?", options: ["À la maison", "Sortir entre amis", "Faire du sport", "Regarder des séries"] },
  { prompt: "Quel est mon rêve professionnel ?", options: ["Entrepreneur", "Cadre stable", "Créatif/artiste", "Fonction publique"] },
  { prompt: "Quelle est ma boisson préférée ?", options: ["Bissap", "Café", "Jus de gingembre", "Thé (Attaya)"] },
  { prompt: "Qu'est-ce qui me détend le plus ?", options: ["La musique", "Le sport", "Dormir", "Parler à toi"] },
];

function expandQuestions(gameType: GameType, core: { prompt: string; options: string[] }[], target: number) {
  const list = [...core];
  const fillers = [
    "Quel est mon souvenir préféré avec toi ?",
    "Quelle qualité chez toi j'admire le plus ?",
    "Quel cadeau me ferait le plus plaisir ?",
    "Quelle habitude chez moi te fait sourire ?",
    "Quel est mon plus grand rêve ?",
    "Quelle est ma peur secrète ?",
    "Quel jour de la semaine je préfère ?",
    "Quelle musique j'écoute quand je suis triste ?",
    "Quel animal me représente le mieux ?",
    "Quelle est ma plus grande fierté ?",
  ];
  let i = 0;
  while (list.length < target) {
    const base = fillers[i % fillers.length];
    list.push({
      prompt: `${base} (#${Math.floor(i / fillers.length) + 1})`,
      options: ["Option A", "Option B", "Option C", "Option D"],
    });
    i++;
  }
  return list.slice(0, target).map((q) => ({ gameType, prompt: q.prompt, options: q.options }));
}

// --- 50 questions "Couple Battle" (MOI / MON PARTENAIRE, options fixes gérées côté client) ---
const battleCore = [
  "Qui est le plus susceptible d'arriver en retard ?",
  "Qui cuisine le mieux ?",
  "Qui est le plus jaloux/jalouse ?",
  "Qui dépense le plus d'argent ?",
  "Qui pardonne le plus vite ?",
  "Qui prend les décisions dans le couple ?",
  "Qui est le plus romantique ?",
  "Qui rit le plus fort ?",
  "Qui garde le plus de rancune ?",
  "Qui est le plus organisé ?",
];

function expandBattle(target: number) {
  const list = [...battleCore];
  let i = 0;
  while (list.length < target) {
    list.push(`Qui est le plus susceptible de... (variante #${i + 1}) ?`);
    i++;
  }
  return list.slice(0, target).map((prompt) => ({
    gameType: GameType.COUPLE_BATTLE as GameType,
    prompt,
    options: ["MOI", "MON PARTENAIRE"],
  }));
}

// --- 30 vérités / 30 défis ---
const truths = [
  "Quel est le mensonge le plus innocent que tu m'aies dit ?",
  "Quel est ton plus grand regret amoureux avant moi ?",
  "Qu'est-ce qui t'a fait craquer pour moi au tout début ?",
  "Quelle est la chose que tu n'oses jamais me dire ?",
  "Quel est ton souvenir le plus embarrassant avec moi ?",
];
function expandTruths(target: number) {
  const list = [...truths];
  let i = 0;
  while (list.length < target) {
    list.push(`Question vérité #${i + 1} : partage un secret que tu n'as jamais dit.`);
    i++;
  }
  return list.slice(0, target).map((text) => ({ type: ChallengeType.TRUTH as ChallengeType, text }));
}

const dares = [
  "Fais un compliment sincère à ton partenaire.",
  "Envoie-lui un vocal de 10 secondes qui dit pourquoi tu l'aimes.",
  "Imite la façon dont ton/ta partenaire parle.",
  "Raconte votre première rencontre de son point de vue.",
  "Chante les 10 premières secondes de votre chanson préférée.",
];
function expandDares(target: number) {
  const list = [...dares];
  let i = 0;
  while (list.length < target) {
    list.push(`Défi #${i + 1} : fais quelque chose de doux pour ton/ta partenaire maintenant.`);
    i++;
  }
  return list.slice(0, target).map((text) => ({ type: ChallengeType.DARE as ChallengeType, text }));
}

async function main() {
  console.log("Nettoyage des tables de contenu...");
  await prisma.answer.deleteMany();
  await prisma.question.deleteMany();
  await prisma.challenge.deleteMany();

  const guessMeQuestions = expandQuestions(GameType.GUESS_ME, guessMeCore, 50);
  const battleQuestions = expandBattle(50);
  const truthChallenges = expandTruths(30);
  const dareChallenges = expandDares(30);

  await prisma.question.createMany({ data: [...guessMeQuestions, ...battleQuestions] });
  await prisma.challenge.createMany({ data: [...truthChallenges, ...dareChallenges] });

  console.log(
    `Seed terminé : ${guessMeQuestions.length} questions "Tu me connais ?", ${battleQuestions.length} "Couple Battle", ${truthChallenges.length} vérités, ${dareChallenges.length} défis.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
