# GAMES.md — Ajouter un jeu à NIO FAR

NIO FAR est conçu pour s'étendre : **un jeu = 2 familles de règles + des cartes de contenu**.
Aucun changement de l'infrastructure (socket, rooms, routes) n'est nécessaire pour ajouter un jeu.

## Architecture en un coup d'œil

```
game_type            game_family            implémentation
─────────────        ────────────           ───────────────
GUESS_ME             STANDARD    ─────┐
TRUTH_OR_DARE        TURN_BASED ──────┤
… (24 jeux)                           ├──> engines: GameEngine + Ruleset
                                      │     server/src/game-engine/
```

- **STANDARD** : deux réponses simultanées, puis révélation ensemble. (question + options)
- **TURN_BASED** : tour par tour, chacun choisit/agit puis valide (`DONE`/`PASS`).

Le **contenu** (questions, options, cartes) vit en base dans `GameCard` et est chargé par le jeu au départ.

---

## Étapes pour ajouter un jeu

### 1. Ajouter la valeur `GAME_TYPE`

`server/prisma/schema.prisma` — ajouter ta valeur dans l'enum `GameType` (ex. `RAPID_FIRE`), puis appliquer :

```bash
cd server
npx prisma migrate dev --name add_game_rapid_fire   # crée la migration
npx prisma migrate deploy                            # l'applique en local
```

### 2. Déclarer le jeu dans le catalogue

`server/src/game-engine/catalog.ts` — ajouter une entrée `GameCatalogEntry` :

```ts
{
  type: "RAPID_FIRE",
  name: "Ping-pong tonique",
  category: "COMPETITION",        // une des 7 catégories existantes
  tagline: "Rebondissez les rôles à toute allure.",
  description: "…",
  glyph: "🏓",
  family: "STANDARD",             // ou "TURN_BASED"
  scoringEnabled: true,
  roundsByDifficulty: { SOFT: 10, NORMAL: 15, INTENSE: 20 },
},
```

> ⚠️ `GameFamily` doit rester l'un des deux points d'entrée d'UI existants.
> Une nouvelle familie = nouveau composant client (même structure que les autres games/).

### 3. Remplir le contenu (seed)

`server/prisma/seed.ts` — ajouter les cartes dans `CARD_BANK` (par `gameType` + `difficulty`).
Chaque carte (`GameCard`) a un `type` (famille de contenu) et un `content`.

- **STANDARD** : le contenu peut inclure des `options` (4 réponses simultanées).
  Le format du prompt DOIT contenir `{player}` pour être personnalisé (remplacé par le nom du joueur).
- **TURN_BASED** : cartes sans options ; `type` = "TRUTH", "DARE", "CHALLENGE", …

Vise **≥ 15 cartes par niveau** (SOFT/NORMAL/INTENSE) : le nombre de tours est
`Math.min(totalRounds, deck.length)` pour ne jamais planter si le deck est court.

Re-seed : `cd server && npx prisma db seed`

### 4. Mapper côté client

`client/src/data/catalog.ts` — ajouter la même entrée (type, nom, catégorie, tagline, glyph, familly, rounds).
C'est cette copie statique qui alimente la home (filtres, favoris, carte de jeu).

La home filtre par catégorie (`CATEGORIES_ORDER`), donc pas d'autre registre à toucher.

### 5. Tester + déployer

```bash
cd server && npx tsc --noEmit     # serveur
cd client && npm run build        # client
git add -A && git commit -m "Add game RAPID_FIRE" && git push
```

Le push sur `main` déclenche l'autodéploiement Render (migration + seed + build).
Vérifier `https://nio-far-server.onrender.com/api/catalog` puis jouer une partie end-to-end.

---

## Fiches de debug rapide

| Symptôme | Cause probable | Correctif |
|---|---|---|
| `EMPTY_DECK` au start | Aucune carte seedée pour ce gameType/niveau | Ajouter des `GameCard` puis re-seed |
| Toujours 6 tours en SOFT | Deck trop court (< 15) | `Math.min(totalRounds, deck.length)` : enrichir la bank |
| `{player}` affiché en clair | Prompt non renseigné | Le remplacer automatiquement dans le prompt |
| Le jeu n'apparaît pas | Entrée client manquante dans `data/catalog.ts` | L'ajouter (étape 4) |

---

## Inventaire actuel (24 jeux)

- **CONNAISSANCE** : GUESS_ME, GUESS_MY_ANSWER, WHO_KNOWS_BEST
- **ACTION_VERITE** : TRUTH_OR_DARE, TRUTH, DARE
- **FUN** : WHO_IS_MORE, WOULD_YOU_RATHER, NO_YES_NO, MIME_PARTNER
- **ROMANTIC** : COMPLIMENT_CHALLENGE, OUR_MEMORIES, COMPLETE_THE_SENTENCE, FIVE_THINGS
- **PROFOND** : DEEP_QUESTIONS, OUR_DREAMS, OUR_FUTURE, OUR_VALUES
- **FLIRT** : FLIRT_QUESTIONS, SEDUCTION_CHALLENGES, IMPOSSIBLE_CHOICE
- **COMPETITION** : COUPLE_BATTLE, TIMED_QUIZ, SPEED_DUEL