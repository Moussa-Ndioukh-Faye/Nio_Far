# NIO FAR ❤️

> « Jouez. Découvrez-vous. Rapprochez-vous. »

Plateforme de jeux multijoueurs en temps réel pour couples à distance.
Chaque joueur se connecte depuis son propre appareil ; le serveur est la
seule source de vérité (scores, réponses, état de partie).

**25 jeux jouables**, répartis en 7 catégories, avec un moteur de jeu
générique (2 familles de règles : STANDARD et TURN_BASED), du contenu
seedé par niveau (SOFT/NORMAL/INTENSE), favoris et historique par
appareil, et multijoueur à distance via Socket.IO.

Pour ajouter un jeu : voir **GAMES.md** (guide en 5 étapes).

## Structure du projet

```
/server
  /prisma
    schema.prisma        # Modèles: User, GameSession, Player, Question, Answer, GameResult, ChatMessage, Challenge, GameEvent
    seed.ts               # 50 questions "Tu me connais ?", 50 "Couple Battle", 30 vérités, 30 défis
  /src
    /game-engine          # GameEngine, RoomManager — logique pure, sans dépendance réseau
    /socket                # Handlers Socket.IO (room, game, chat, presence)
    /routes /controllers   # API REST (health check, création de session, récupération des résultats)
    /middleware            # rate limiting, CORS, validation
    /utils                 # génération de codes de room, logger
    server.ts               # point d'entrée

/client
  /src
    /socket                # client Socket.IO singleton + hooks
    /contexts              # GameContext (état de la room côté client)
    /pages                 # Home, CreateGame, JoinGame, Room
    /components            # PresenceBadge, InviteShare, WaitingRoom
    /types                  # types partagés avec le serveur (à dupliquer ou lier via un package "shared" plus tard)
```

## Installation

### Prérequis
- Node.js 20+
- PostgreSQL 14+ (local ou managé : Railway, Render, Supabase, Neon…)
- npm

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
# renseigner DATABASE_URL, JWT_SECRET, CLIENT_URL dans .env
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Le serveur démarre sur `http://localhost:4000` (REST + WebSocket sur le
même port).

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env
# renseigner VITE_SERVER_URL dans .env
npm run dev
```

Le client démarre sur `http://localhost:5173`.

### 3. Tester le multijoueur réel

- Onglet 1 (navigateur normal) : créer une partie → récupérer le code (ex `NF-82K7`)
- Onglet 2 (fenêtre privée, ou un second appareil sur le même réseau via
  l'IP locale de ta machine) : rejoindre avec le code
- Les deux écrans doivent afficher "🟢 En ligne" pour les deux joueurs

## Variables d'environnement

### server/.env
```
DATABASE_URL=postgresql://user:password@localhost:5432/niofar
JWT_SECRET=change-me-in-production
CLIENT_URL=http://localhost:5173
PORT=4000
```

### client/.env
```
VITE_SERVER_URL=http://localhost:4000
```

## PostgreSQL & Prisma

Le schéma (`server/prisma/schema.prisma`) modélise :
- `User` (optionnel pour le MVP — prévu pour les comptes futurs)
- `GameSession` (roomId, code, gameType, status, hostId, createdAt, expiresAt)
- `Player` (nom, socketId, sessionId, isConnected, score)
- `Question` / `Answer`
- `GameResult` (score de couple, stats finales)
- `ChatMessage`
- `Challenge` (vérité/défi)
- `GameEvent` (log des événements pour audit / debug / anti-triche)

Commandes utiles :
```bash
npx prisma studio           # explorer la DB visuellement
npx prisma migrate dev      # créer une migration
npx prisma migrate deploy   # appliquer en production
npx prisma db seed          # relancer le seed
```

## Fonctionnement Socket.IO

Le serveur maintient un `RoomManager` en mémoire (les rooms actives) qui
persiste les événements importants en base via Prisma (pour la
reconnexion et l'historique). Voir `server/src/socket/index.ts` pour la
liste complète des événements (`room:create`, `room:join`,
`answer:submit`, `answers:reveal`, `player:disconnect`,
`player:reconnect`, `game:resume`, `chat:message`, etc.).

Règle d'or : **le client n'envoie jamais un score ou un état de jeu au
serveur** — il envoie uniquement des *intentions* (`answer:submit`,
`player:ready`…), et le serveur répond avec l'état faisant autorité.

## Déploiement

- **Frontend** : Vercel ou Netlify (build Vite standard)
- **Backend** : Render, Railway ou VPS — **pas de plateforme serverless
  classique** (Vercel Functions, Netlify Functions), car Socket.IO a
  besoin de connexions WebSocket persistantes que ces environnements ne
  supportent pas correctement. Render/Railway/VPS avec un processus Node
  long-running conviennent.
- **Database** : PostgreSQL managé (Railway, Render, Supabase, Neon)

Variables à définir en production : `DATABASE_URL`, `JWT_SECRET`,
`CLIENT_URL`, `SERVER_URL`.

## Tests

```bash
cd server
npm test        # Vitest : règles, moteur, et une vraie partie Socket.IO à 2 clients
```

Les tests n'ont pas besoin de PostgreSQL (contenu et persistance simulés).

## Mécaniques de jeu

- **Réponses simultanées** (STANDARD) : révélation quand les deux ont répondu.
  Les questions « Qui de nous deux ? » (options `MOI` / `MON PARTENAIRE`)
  sont comparées sur la personne désignée, pas sur le texte du bouton.
- **Chrono** (Quiz chronométré 15 s, Duel de rapidité 7 s) : échéance gérée
  par le serveur, réponses tardives refusées, bonus au plus rapide.
- **Tour par tour** : le joueur répond par écrit (vérités, questions) ou
  réalise l'action, puis **son/sa partenaire valide** — plus d'auto-validation.
- **Revanche** dans la même room, **récap** de la partie, chat conservé
  (100 derniers messages) et indicateur « est en train d'écrire ».

## Contenu

Le seed **synchronise** les cartes à chaque démarrage : il ajoute les
nouvelles, désactive celles retirées et ne supprime jamais rien.
Le contenu Action ou Vérité / Questions de couple est dans
`server/prisma/content/couple.ts` (3 niveaux).

### Frontend sur Vercel

1. vercel.com → **Add New… → Project** → importer `Moussa-Ndioukh-Faye/Nio_Far`
2. **Root Directory** : `client` (framework Vite détecté, `client/vercel.json` fait le reste)
3. **Environment Variables** : `VITE_SERVER_URL = https://nio-far-server.onrender.com`
4. **Deploy**, puis ajouter l'adresse Vercel à `CLIENT_URL` sur Render
   (plusieurs adresses possibles, séparées par des virgules).

Ensuite chaque push sur `main` redéploie le frontend automatiquement.

## Design et normes

Voir **DESIGN.md** : identité, jetons, composants, et normes respectées
(WCAG 2.2 AA, RGPD / loi 2008-12, OWASP). Audit : axe-core 0 violation sur
13 écrans, Lighthouse accessibilité / bonnes pratiques / SEO = 100.

## PWA

L'app s'installe sur l'écran d'accueil (Android, iOS, desktop) :
manifest, icônes (`client/public/icons`), service worker généré par
`vite-plugin-pwa`. Les mises à jour sont proposées (jamais imposées en
pleine partie). L'API et le WebSocket ne passent jamais par le cache.

## Prochaines étapes (au-delà de ce scaffold)

- Phase 6 (approfondir) : brancher les 3 mini-jeux au GameEngine générique déjà en place
- Phase 11 : renforcer la reconnexion (grace period configurable, présence Redis si scale horizontal)
- Phase 12 : UI/UX premium + Framer Motion
- Phase 13-14 : tests automatisés + déploiement production

➡️ Pour la suite, **Claude Code** (terminal ou desktop) est l'outil recommandé :
tu pourras lancer le serveur, ouvrir plusieurs onglets/appareils, et itérer
phase par phase avec Git.
