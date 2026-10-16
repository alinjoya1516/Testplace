# Journal

## 2026-10-15 — Incrément 1

- Fait :
  - Socle : monorepo npm workspaces (`apps/api` NestJS 12, `apps/web` Angular 22 + Material, `packages/shared`), oxlint, Jest, CI GitHub Actions (lint, tests, build, build Docker).
  - `GET /api/health` (vérifie la base, 503 si elle est indisponible) ; l'API sert le front compilé.
  - `Dockerfile` et `docker-compose.yml` (application + PostgreSQL 16) ; migrations appliquées au démarrage ; conteneur non root ; ports liés à localhost.
  - Conventions d'import dans `apps/api/config/import-conventions.json`, validées au chargement.
  - Parseur `.feature` (`apps/api/src/imports/feature-parser.ts`) et ses tests : critères 1 et 2 couverts au niveau du parseur.
  - Jeu d'exemple `samples/features` : 3 fichiers, 9 cas, dont un Scenario Outline à deux blocs Examples.
  - Schéma Prisma (User, Requirement, ImportRevision, TestCase, TestCaseVersion, Step) et migration `init`.
- Décisions :
  - Poste : Node 24 LTS via Homebrew (`nvm` reste installé avec Node 20 et passe devant dans le PATH), Docker via Colima.
  - `Docs/` renommé `docs/` ; référence au cahier des charges corrigée dans `CLAUDE.md`.
  - Écart au §8 validé : tags, priorité et exigences sont copiés dans `TestCaseVersion` et entrent dans l'empreinte ; `TestCase` garde les valeurs courantes pour les filtres.
  - L'empreinte exclut le fichier et la ligne : déplacer un scénario ne crée pas de version, l'emplacement est mis à jour.
  - Parseur : `And` / `But` / `*` héritent du mot-clé précédent ; un `Then` sans `When` crée une étape à action vide avec un avertissement ; numérotation `.1`, `.2`… continue d'un bloc Examples à l'autre ; tags des Examples ajoutés au cas ; l'identifiant n'est lu que sur les tags du scénario, pas de la Feature ni de la Rule.
  - Ajout d'une règle de rejet non prévue au §4.3 : un scénario avec plusieurs tags `@TC-` est rejeté (identité ambiguë).
  - Lignes de description sans mot-clé avant le premier champ : ignorées avec un avertissement ; après un champ, elles le prolongent.
  - Tableaux et DocStrings d'une étape gardés dans son texte, pour l'exécutant.
  - Tags obligatoires : aucun par défaut.
  - Les imports rejetés seront aussi enregistrés comme révisions (statut REJECTED).
  - Outils : TypeScript 6.0 (seule version acceptée à la fois par Angular 22 et typescript-eslint) ; oxlint, outil de lint du modèle NestJS 12 ; Prisma 7.10 (stable, la 8 est en RC) avec l'adaptateur `pg` ; `zod` pour valider le fichier de conventions et, plus tard, les entrées ; pas de tests unitaires front (parcours couverts par Playwright).
  - Polices système plutôt que Google Fonts : le serveur interne peut ne pas avoir accès à Internet.
- Ouvert :
  - `npm audit` : 24 vulnérabilités (4 hautes) dans les outils (CLI Prisma : `mysql2`, `deepmerge-ts` ; Jest : `sprintf-js`), sans correctif hors retour en arrière de version majeure. À revoir avec l'analyse des dépendances en CI (ENF-05, incrément 3).
  - En-têtes de sécurité (helmet), CSRF, HTTPS : incrément 3.
  - Les mots-clés de commentaire et de description sont sensibles à la casse.
- Prochaine étape : import d'une archive `.zip` par téléversement (EF-01, EF-02) : extraction et validation de l'archive, enregistrement des versions, cas retirés, révision et rapport, écran Import ; puis utilisateur fictif de développement.

## 2026-10-16 — Incrément 1

- Fait :
  - Lecture de l'archive `.zip` en mémoire (`feature-archive.ts`) : seuls les `.feature` sont lus, les autres fichiers sont listés dans le rapport, les fichiers système macOS et Windows ignorés ; rejet des chemins dangereux, des archives corrompues, trop grosses une fois décompressées (vérifié sur les tailles déclarées, avant décompression), avec trop de fichiers, sans `.feature`, ou contenant un fichier non UTF-8.
  - `POST /api/imports` (201 appliqué, 422 rejeté, rapport dans les deux cas ; 400 sans archive ou commit invalide ; 413 au-delà de la taille maximale), `GET /api/imports`, `GET /api/imports/{id}`.
  - Import en base dans une transaction, sérialisé par un verrou PostgreSQL : nouvelles versions seulement si l'empreinte change, cas absents retirés, cas retirés restaurés, emplacement source mis à jour sans nouvelle version, exigences créées depuis les tags. Les imports rejetés sont enregistrés sans rien modifier d'autre.
  - Configuration de l'environnement validée au démarrage (`app-config.ts`) ; garde d'authentification globale (toutes les routes privées sauf `@Public()`) ; utilisateur fictif « Dev Admin » quand `AUTH_MODE=dev`, refusé si `NODE_ENV=production`.
  - Écran Import : téléversement, rapport (compteurs, identifiants, erreurs et avertissements avec fichier et ligne, fichiers ignorés), historique cliquable. Interface en locale `fr-FR`.
  - Tests d'intégration sur PostgreSQL (`npm run test:int`) : critères 1 et 2 vérifiés de bout en bout côté API. CI avec un service PostgreSQL.
- Décisions :
  - Validées avant de coder : utilisateur fictif et garde de production ; codes de réponse de `POST /api/imports` ; limites de 5 Mo pour l'archive, 20 Mo décompressée et 1 000 fichiers, réglables par variables d'environnement.
  - Nouvelle dépendance : `fflate` (lecture du zip, sans dépendance).
  - Une archive refusée par la limite de taille (413) n'est pas enregistrée comme révision : elle est arrêtée avant d'atteindre le service.
  - Restauré et modifié ne s'excluent pas : un cas retiré qui revient avec un contenu changé apparaît dans les deux listes.
  - `prisma migrate reset` est bloqué par Prisma quand un agent IA le lance. Les tests d'intégration appliquent donc les migrations avec `prisma migrate deploy` puis vident les tables par `TRUNCATE`, uniquement sur une base dont l'URL diffère de `DATABASE_URL` et dont le nom contient « test ».
  - Dans l'image Docker (`NODE_ENV=production`), l'import répond 401 tant qu'OpenID Connect n'est pas en place (incrément 3).
  - L'API écoute sur `127.0.0.1` par défaut (variable `HOST`) : en mode dev, quiconque atteint le port est administrateur. L'image Docker écoute sur `0.0.0.0`, son port n'étant publié que sur localhost.
  - Vérification manuelle faite dans l'interface : import du jeu d'exemple, import rejeté avec fichier et ligne, fichier non zip rejeté.
- Ouvert :
  - Les noms d'archive avec accents peuvent être mal décodés par multer (affichage seulement).
  - Le parcours de l'écran Import n'est pas encore couvert par Playwright.
- Prochaine étape : liste des cas avec recherche et filtres (EF-03), fiche de cas avec historique des versions (EF-04), tests Playwright des parcours import et consultation. Fin de l'incrément 1.

## 2026-10-16 — Incrément 1 (suite)

- Fait :
  - `GET /api/cases` (EF-03) : recherche dans l'identifiant, le titre et les étapes de la version courante, sans tenir compte de la casse ; filtres par tags (tous requis, `@` facultatif), priorité, statut et exigence ; cas retirés masqués sauf filtre « Retiré » ; ordre naturel des identifiants ; valeurs disponibles pour les filtres (`facets`).
  - `GET /api/cases/{id}` (EF-04) : version courante ou `?version=n`, liste des versions.
  - Écrans Cas : liste filtrable (filtres gardés dans l'URL) et fiche en lecture seule (questions ouvertes en tête, champs, préconditions, étapes, nettoyage, notes, source, versions consultables).
  - Écrans chargés à la demande : paquet initial ramené de 621 à 386 Ko (budget Angular 500 Ko).
  - Playwright (`e2e/`, Chromium) : critère 1 (import, liste, recherche, fiche, réimport sans nouvelle version), critère 2 (erreurs avec fichier et ligne), filtres de la liste. Lancé aussi dans la CI, rapport conservé en cas d'échec.
- Décisions :
  - Validées avant de coder : paramètres de recherche et filtres, pas de pagination (500 cas au plus), versions consultables par `?version=`.
  - Ajout non annoncé dans le plan : la réponse de `GET /api/cases` contient `facets` (tags, priorités, exigences présents) pour remplir les filtres ; les tags d'identifiant, d'exigence et Jira en sont exclus.
  - Libellés des statuts : « Ready », « Draft », « Retiré », comme dans EF-03 ; priorité affichée avec une majuscule (« Critical », comme au §4.2).
  - Les conventions d'import sont chargées par le module commun, partagé par l'import et les cas.
  - Playwright épinglé en 1.63.0 : la 1.64 avait moins de deux semaines.
  - Nouvel espace de travail `e2e` avec `pg` (vider la base de test) et `fflate` (construire les archives).
- Ouvert :
  - Historique des exécutions dans la fiche de cas (EF-04) : à ajouter à l'incrément 2, quand les exécutions existeront.
  - Canal Edge pour Playwright (ENF-08) si besoin.
- Correctif : `npm run build` (lancé par `npm run test:e2e`) vidait `apps/api/dist`, d'où tournait l'API de développement, qui s'arrêtait. Le mode développement compile maintenant dans `apps/api/dist-dev` (`tsconfig.dev.json`).
- Vérification manuelle : `npm run test:e2e` réussi sur le poste de l'utilisateur.
- Prochaine étape : validation de l'incrément 1 (critères 1 et 2), puis incrément 2 (campagnes et exécution).
