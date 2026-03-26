# Cricket High Phone Server

## Documentation


| Doc                                                                            | Audience                                                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **[Client integration — Redis cache + Socket.IO](docs/CLIENT_INTEGRATION.md)** | Frontend / mobile: JWT, `GET /api/v1/match/:id`, Socket.IO `match:join` / `match:update` |
| **[WebSocket architecture](websocket.md)**                                     | Backend pipeline, terminal WS, Redis cache keys, `redis-adapter`                         |
| **[Match betting API](docs/README_Match_Betting_API.md)**                      | Betting flows                                                                            |


## Local development

- Copy `.env.example` to `.env.development.local` and set secrets, `DB_*`, and `**REDIS_URL`** (e.g. `redis://127.0.0.1:6379` or `redis://redis:6379` in Docker).
- `docker compose up` starts MongoDB, Redis, and the app (see `docker-compose.yml`).
- **Docker + new npm dependencies:** the `server_node_modules` volume can hide updated `package.json` deps. If the app crashes with `Cannot find module '…'`, run:
  ```bash
  docker compose run --rm server npm install
  ```
  then `docker compose up` again (or remove the `server_node_modules` volume once and rebuild).

## Production (Docker Compose)

- `docker compose -f docker-compose.prod.yml up --build` starts MongoDB, **Redis**, and the app with the same in-network URLs as dev: `DB_URL` / `REDIS_URL` point at `mongodb` / `redis` services.
- Ensure `.env.production` still defines app secrets (`APP_SECRET_KEY`, etc.); compose overrides `PORT`, `DB_URL`, and `REDIS_URL` for container networking.  