# Testplace

Outil web interne de gestion des tests manuels, relié à Jira. La spécification est dans [docs/cahier-des-charges-outil-de-test.md](docs/cahier-des-charges-outil-de-test.md).

## Prérequis

- Node.js 24 (voir `.nvmrc`)
- Docker avec Compose (Docker Desktop, OrbStack ou Colima)

## Installation

```sh
npm install
cp .env.example .env   # puis changer POSTGRES_PASSWORD et DATABASE_URL
```

## Développement

```sh
npm run db:up        # PostgreSQL 16 dans Docker, sur localhost uniquement
npm run db:migrate   # applique les migrations Prisma
npm run dev:api      # API sur http://localhost:3000/api
npm run dev:web      # front sur http://localhost:4200, /api redirigé vers l'API
```

## Vérifications

```sh
npm run lint
npm test             # tests unitaires
npm run test:int     # tests d'intégration, sur la base TEST_DATABASE_URL (vidée par les tests)
npm run test:e2e     # build puis tests Playwright, même base de test, API sur le port 3100
npm run build
```

Avant le premier `npm run test:e2e` : `npx playwright install chromium`.

## Authentification

En attendant OpenID Connect, `AUTH_MODE=dev` attribue chaque requête à un administrateur fictif « Dev Admin ». Ce mode est refusé si `NODE_ENV=production`, ce qui est le cas de l'image Docker : sans authentification, seul `/api/health` y répond.

## Lancement complet avec Docker

```sh
docker compose up -d --build
```

L'application est servie sur http://localhost:8080 ; les migrations s'appliquent au démarrage. L'état du serveur est sur `/api/health`.

## Structure

| Dossier | Contenu |
| --- | --- |
| `apps/api` | API NestJS, schéma et migrations Prisma, conventions d'import (`config/import-conventions.json`) |
| `apps/web` | Front Angular |
| `packages/shared` | Types partagés entre l'API et le front |
| `samples/features` | Jeu de fichiers `.feature` d'exemple (données synthétiques) |
| `e2e` | Tests de bout en bout Playwright |
