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
