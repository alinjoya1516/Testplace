# Outil de gestion des tests

Outil web interne de gestion des tests manuels, relié à Jira. La spécification complète est dans `docs/cahier-des-charges-outil-de-test.md` : c'est la référence. Tu t'y conformes et tu signales tout écart avant de le faire. Les numéros EF et ENF ci-dessous renvoient à ses exigences.

## Comment je travaille

- Je développe seul, par sessions de 2 à 4 heures, en parallèle d'un autre travail. Chaque session se termine sur une application qui démarre et des tests qui passent.
- Discussion en français ; code, noms, commits et commentaires en anglais.
- Commentaires uniquement pour expliquer le pourquoi, jamais le quoi.
- Le plus simple qui marche : pas d'abstraction tant qu'un deuxième cas d'usage ne l'exige pas, sauf pour le connecteur Jira (voir les règles).

## Stack figée

Ne la remets pas en question sans que je le demande.

| Couche | Choix |
| --- | --- |
| Dépôt | Monorepo npm workspaces : `apps/api`, `apps/web`, `packages/shared` pour les types partagés |
| Backend | NestJS, TypeScript en mode strict |
| Base de données | PostgreSQL 16, Prisma avec migrations versionnées |
| Frontend | Angular (composants standalone), Angular Material |
| Gherkin | `@cucumber/gherkin`, `@cucumber/messages`, `@cucumber/tag-expressions` |
| Tests | Jest côté API, Playwright pour les parcours de bout en bout |
| Exécution | `docker compose` (API qui sert aussi le front, PostgreSQL), fichier `.env.example`, aucun secret versionné |
| CI | Lint, tests et build à chaque merge request |

## Commandes

À compléter par toi dès l'incrément 1, puis à tenir à jour à chaque changement.

| Action | Commande |
| --- | --- |
| Installer | Node 24 (`.nvmrc`), puis `npm install` et `cp .env.example .env` |
| Lancer en local | `npm run db:up`, `npm run db:migrate`, puis `npm run dev:api` (port 3000) et `npm run dev:web` (http://localhost:4200) |
| Lancer tout en Docker | `docker compose up -d --build` (http://localhost:8080) |
| Lint | `npm run lint` |
| Tests unitaires | `npm test` |
| Tests d'intégration | `npm run db:up` puis `npm run test:int` (base `TEST_DATABASE_URL`, vidée par les tests) |
| Build | `npm run build` |
| Tests de bout en bout | `npm run db:up` puis `npm run test:e2e` (build, puis Playwright sur le port 3100 et la base `TEST_DATABASE_URL`) ; une fois : `npx playwright install chromium` |
| Migration de base | `npm run db:migrate` (crée et applique une migration en dev) ; en Docker, `prisma migrate deploy` s'exécute au démarrage |

## Plan d'incréments

Un seul incrément à la fois. On passe au suivant seulement quand la colonne « Terminé quand » est atteinte et que je l'ai validée.

| # | Incrément | Contenu | Terminé quand |
| --- | --- | --- | --- |
| 1 | Socle et catalogue | Monorepo, `docker compose`, CI, endpoint de santé ; jeu de fichiers `.feature` d'exemple ; import d'une archive par téléversement (EF-01, EF-02) ; liste et fiche de cas (EF-03, EF-04) ; conventions d'import dans un fichier de configuration (l'écran d'EF-36 viendra à l'incrément 7) ; utilisateur fictif en mode développement | Critères d'acceptation 1 et 2 du cahier des charges |
| 2 | Campagnes et exécution | EF-06 à EF-10, EF-12, EF-13, EF-14 pour les commentaires seulement, EF-15 à EF-19, tableau de bord de campagne (EF-25) | Critère 3, en local |
| 3 | Mise en service | Authentification OpenID Connect et rôles (EF-34, ENF-02), page d'accueil (EF-26), déploiement sur serveur en HTTPS (ENF-01, ENF-05), sauvegarde et restauration | Critères 5 et 6 ; une première vraie campagne menée en parallèle de l'outil actuel |
| 4 | Jira et pièces jointes | Pièces jointes (EF-14), configuration Jira avec test de connexion (EF-35), lien d'un bug existant et affichage de son statut (EF-21, EF-23), création d'un bug avec lien distant (EF-20, EF-22), ENF-04 | Critère 4. Fin du MVP |
| 5 | Traçabilité | EF-05, EF-24, EF-27 | Matrice exacte sur le jeu d'exemple |
| 6 | Résultats automatisés | Jetons d'API (EF-37), import par l'API (EF-01), EF-31 à EF-33 | Un rapport JUnit d'exemple crée les exécutions attendues |
| 7 | Historique et administration | EF-11, EF-28, EF-29, écran des conventions d'import (EF-36), EF-38 | Exigences couvertes par des tests |
| Plus tard | — | EF-30, connecteur Jira Cloud | — |

## Déroulé d'une session

1. Lis `docs/JOURNAL.md` et les sections du cahier des charges utiles à l'incrément en cours. Résume en deux lignes où on en est.
2. Propose un plan de session : trois tâches au plus, chacune vérifiable. Attends mon accord avant de modifier quoi que ce soit.
3. Implémente, avec les migrations Prisma et les tests. Lance toi-même le lint, les tests et le build, et corrige jusqu'à ce qu'ils passent.
4. Dis-moi ce que je dois vérifier à la main dans l'interface, avec les étapes exactes.
5. Ajoute une entrée à `docs/JOURNAL.md`, mets à jour la section « Commandes » de ce fichier si besoin, et propose un message de commit. Ne commite et ne pousse jamais sans mon accord.

## Règles

- Ce qui sort de l'incrément en cours ne s'implémente pas : note-le dans la section « Ouvert » du journal.
- Si une demande contredit le cahier des charges, dis-le et demande-moi de trancher. La décision va dans le journal.
- Pour une décision structurante (modèle de données, sécurité, API), pose la question avant de coder. Pour un petit choix, décide et dis-le en une ligne.
- Justifie toute nouvelle dépendance en une phrase ; préfère celles déjà présentes.
- Le connecteur Jira est une interface avec deux implémentations : une fausse, en mémoire, pour le développement et les tests, et la vraie (Jira Data Center, API REST v2, jeton d'accès personnel). Tout se développe contre la fausse ; la vraie ne se branche qu'avec un accès réel.
- Données de test synthétiques uniquement, y compris le jeu de fichiers `.feature` d'exemple. Ne me demande jamais de données réelles de mon entreprise.
- Sécurité dès le départ : validation des entrées et des fichiers téléversés, aucun secret dans le code ni dans les logs, `.env` dans `.gitignore`.
- Tests obligatoires pour le parseur d'import, le calcul des statuts (EF-13) et le connecteur Jira.
- Quand tu estimes un effort, donne une fourchette et tes hypothèses ; ne présente jamais une estimation comme une certitude.
- Si tu n'es pas sûr d'une API ou d'une version de bibliothèque, vérifie dans la documentation ou dans `node_modules` plutôt que d'inventer.

## Journal

`docs/JOURNAL.md` garde la mémoire entre les sessions. Ajoute une entrée à la fin de chaque session, sous cette forme :

```markdown
## <date> — Incrément <n>

- Fait :
- Décisions :
- Ouvert :
- Prochaine étape :
```
