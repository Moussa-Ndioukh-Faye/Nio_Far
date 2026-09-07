# NIO FAR ❤️

> « Jouez. Découvrez-vous. Rapprochez-vous. »

Plateforme de jeux multijoueurs en temps réel pour couples à distance.
Chaque joueur se connecte depuis son propre appareil ; le serveur est la
seule source de vérité (scores, réponses, état de partie).

Ce scaffold couvre les **Phases 1 à 4** du plan de développement :

1. Architecture + configuration du monorepo
2. PostgreSQL + Prisma (schéma, migrations, seed)
3. Système de rooms (GameEngine + RoomManager)
4. Serveur Socket.IO (événements temps réel)

Le client React fourni est un squelette minimal qui permet de **tester
la connexion de deux navigateurs différents** (Phase 5) : créer une
partie, rejoindre avec un code, voir la présence en ligne. Les 3 mini-jeux
(Phases 7-9), le chat riche, les animations Framer Motion et l'UI premium
(Phases 10-12) sont à construire par-dessus cette base — la structure est
prévue pour ça (voir "Prochaines étapes" plus bas).

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

Un dossier `server/src/__tests__` est prévu pour des tests unitaires du
`GameEngine` (logique pure, facile à tester sans réseau). Recommandé :
Vitest ou Jest. À ajouter dans une phase ultérieure (Phase 13).

## Prochaines étapes (au-delà de ce scaffold)

- Phase 6 (approfondir) : brancher les 3 mini-jeux au GameEngine générique déjà en place
- Phase 10 : enrichir le chat (timestamps affichés, notifications, historique)
- Phase 11 : renforcer la reconnexion (grace period configurable, présence Redis si scale horizontal)
- Phase 12 : UI/UX premium + Framer Motion
- Phase 13-14 : tests automatisés + déploiement production

➡️ Pour la suite, **Claude Code** (terminal ou desktop) est l'outil recommandé :
tu pourras lancer le serveur, ouvrir plusieurs onglets/appareils, et itérer
phase par phase avec Git.
