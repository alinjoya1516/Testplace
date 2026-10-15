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
npm test
npm run build
```

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
