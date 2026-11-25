# DESIGN.md — Système de design et normes de NIO FAR

Ce document décrit l'identité visuelle de NIO FAR et les normes que l'interface
respecte. Toute nouvelle page ou composant doit s'y conformer.

## 1. Identité

| Élément | Valeur |
|---|---|
| Logo | `client/src/components/Mark.tsx` (SVG) — manette-infini, deux personnes, cœur |
| Mot-symbole | `<Wordmark />` — « Nio far », cœur sur le i, « far » en dégradé |
| Fond | nuit `#070113` + halos qui dérivent + cœurs `#2A0638` (`Backdrop.tsx`) |
| Accent | rose `#FD2B78` → corail `#FE4D4F` (variables `--acc`, `--acc-2`) |
| Matière | verre dépoli : `.glass` (dégradé blanc 11 % → 3 %, `blur(40px) saturate(1.5)`) |
| Titres | Fredoka (variable, auto-hébergée) |
| Texte | Nunito (variable, auto-hébergée) |

L'accent se change en un clic (`src/theme.ts`) : Rose, Corail, Violet, Bissap.

## 2. Jetons (Tailwind)

| Jeton | Couleur | Usage | Contraste sur la nuit |
|---|---|---|---|
| `paper` | `#FFF8FC` | texte principal | 19,6 : 1 |
| `sand` | `#DCCBEA` | texte secondaire | 13,5 : 1 |
| `mute` | `#9C88B3` | texte discret | 6,4 : 1 |
| `saffron` | `#FFB3D1` | surlignage, codes | 12,3 : 1 |
| `leaf` | `#4ADE9B` | succès, accord | 11,9 : 1 |
| `bissap` | `#FF4D5E` | erreur, désaccord | 6,3 : 1 |
| `clay` | accent | liens, anneaux, détails | ≥ 4,3 : 1 |

Boutons pleins (`.btn-clay`) : dégradé `--btn-1` → `--btn-2`, versions plus
profondes de l'accent choisies pour que **le texte blanc dépasse 4,5 : 1** sur
toute la largeur, pour chacun des 4 accents.

**Typographie** : 12 px minimum (`text-xs`) pour tout texte, y compris badges et
légendes. Corps 14–16 px, titres en Fredoka 600–700.

**Espacements et formes** : grille de 4 px (Tailwind), rayons `rounded-2xl`
(contrôles) et `rounded-3xl` (cartes), ombres `shadow-card` / `shadow-lift`.

## 3. Composants

- `.card` : surface en verre ; `.btn` (44 px min), `.btn-clay` (action principale,
  une seule par écran), `.btn-ghost` (secondaire), `.field` (champs), `.tag`, `.eyebrow`.
- Cartes de jeu : un seul bouton dont la zone (`::after`) couvre la carte ;
  le favori est un bouton séparé (jamais d'interactif imbriqué).
- Fiche de jeu : dialogue modal (`role="dialog"`, focus piégé, Échap, retour du focus).
- États toujours prévus : vide, chargement (`role="status"`), erreur (`role="alert"`),
  hors ligne (bandeau), mise à jour disponible (toast).

## 4. Mouvement

- Entrée des cartes : sortie du flou + légère rotation 3D (0,55 s, `[0.22,1,0.36,1]`).
- Intro « la pièce s'allume » : révélation circulaire (`clip-path`), une fois par session.
- Confettis + vibration sur les accords et les cartes validées.
- **`prefers-reduced-motion`** : Framer Motion (`MotionConfig reducedMotion="user"`),
  animations CSS et confettis sont coupés. **`prefers-reduced-transparency`** :
  surfaces opaques à la place du verre.

## 5. Normes respectées

### Accessibilité — WCAG 2.2 niveau AA
- Contrastes ≥ 4,5 : 1 pour le texte (1.4.3), ≥ 3 : 1 pour les composants (1.4.11).
- Cibles tactiles ≥ 44 × 44 px (2.5.8 + recommandations Apple HIG / Material).
- Repères : `header`, `main`, `nav`, `footer`, lien « Aller au contenu » (2.4.1).
- Nom accessible = texte visible (2.5.3) ; icônes et émojis décoratifs en `aria-hidden`.
- Annonces vocales des changements de partie (`aria-live`) : tour, révélation, résultat (4.1.3).
- Chrono en `role="timer"`, chat en `role="log"`, filtres en `aria-pressed`,
  niveaux et couleurs en `radiogroup`.
- Navigation complète au clavier, focus toujours visible (2.4.7).
- Langue de la page `fr` (3.1.1), libellés sur tous les champs (3.3.2).

Vérifié avec **axe-core** sur 13 écrans (0 violation) et **Lighthouse**
(accessibilité 100). Relancer : voir `README.md` › Tests.

### Données personnelles — RGPD et loi sénégalaise n° 2008-12
- Minimisation : prénom, réponses, messages, identifiant d'appareil aléatoire. Pas de compte.
- Conservation limitée : purge automatique des parties après 30 jours (`RETENTION_DAYS`).
- Droit à l'effacement : bouton « Effacer mes données » (`DELETE /api/me`).
- Information claire : page `/confidentialite` (responsable, finalités, hébergeurs, droits, CDP).
- Pas de cookie ni de traceur : uniquement du stockage local fonctionnel.
- Contenu adulte (niveau Intense, catégorie Flirt) : confirmation 18 ans et plus.

### Sécurité — OWASP
- En-têtes : CSP stricte, HSTS, `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy` (Netlify) ; `helmet` côté Express.
- Serveur autoritaire, validation Zod de chaque message, limites de débit
  (REST + Socket.IO), corps de requête ≤ 10 ko, messages Socket.IO ≤ 16 ko.
- Cloisonnement des rooms (chat, actions, revanche) et lancement réservé à l'hôte.

### PWA
- Manifest complet, icônes `any` + `maskable`, service worker (mise à jour proposée,
  jamais imposée), polices et interface disponibles hors ligne.
