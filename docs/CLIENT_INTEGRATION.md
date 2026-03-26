# Client integration guide — match cache (Redis) and Socket.IO

This document is for **frontend and mobile apps** integrating with the Cricket backend after the **Redis-backed match cache** and **authenticated Socket.IO** changes. Server-side Redis details are optional reading; clients only need the **HTTP** and **WebSocket** contracts below.

---

## 1. What changed (summary)

| Area | Before | After |
|------|--------|--------|
| **Fast match read** | In-process `Map` cache | **Redis** (`REDIS_URL` on server only — clients do not configure Redis) |
| **GET `/api/v1/match/:matchId`** | Read from cache; same auth | Same **auth** and **response shape**; data may come from Redis on the server |
| **Socket.IO** | Open connection, no JWT | **JWT required** on connect (admin **or** user, same rules as REST `adminOrUserMiddleware`) |
| **Multi-server / replicas** | N/A | Server uses **`@socket.io/redis-adapter`** so `match:update` reaches all nodes; **no client change** for this |

---

## 2. Base URLs and paths

- **REST API base:** `{API_ORIGIN}/api/v1`  
  Example: `https://your-api-host/api/v1`

- **Socket.IO (Engine.IO):** same **origin** as the API by default, path **`/socket.io/`** (Socket.IO v4 default).  
  Full URL example: `https://your-api-host` (pass this to `io()`, not `.../socket.io` as a URL path — the client library appends `/socket.io/`).

Use **HTTPS** (or `http://` for local dev) consistently with your API.

---

## 3. REST — authenticated match snapshot (cache-backed)

### Endpoint

`GET /api/v1/match/:matchId`

- **`matchId`** is the **`eventId`** string (same id used for Socket rooms and terminal `gameId` flows where applicable).

### Authentication (unchanged)

Same as other match routes that use **admin OR user**:

1. **Cookie:** `Authorization=<JWT>` (if your app uses cookie-based sessions with `credentials: 'include'`).
2. **Header:** `Authorization: Bearer <JWT>`.

**Admin JWT:** signed with the server’s admin secret; admin must exist and be active (`status: true`).  
**User JWT:** signed with the app secret; payload must include **`sessionToken`** matching the user’s session in the database (same as login flow).

### Success response

- **200** — JSON with `match` object: full **UltraFast** payload (shape from `UltraFastMatchService.getMatchByIdUltraFast`), including odds projection.
- **404** — `Match not found` when the match is **not** in the active cache (e.g. inactive, declared, or never cached).

### Client notes

- Responses are **cached on the server in Redis**; you still call this endpoint as before. No Redis URL in the client.
- For **sub-150ms** targets, the server sets `X-Response-Time` and related headers (see controller).

---

## 4. Socket.IO — required authentication

### 4.1 Who can connect

Exactly one of:

- **Admin** — valid admin JWT (same as REST admin routes).
- **User** — valid user JWT with **session token** match (same as REST `authMiddleware`).

Anonymous connections are **rejected** during the handshake (`connect_error`).

### 4.2 How to send the token (pick one)

| Method | When to use |
|--------|-------------|
| **`auth.token`** | **Recommended** — SPA (React/Vue), React Native, Flutter, native apps. |
| **`Authorization` cookie** | Browser apps that already store the JWT in the `Authorization` cookie; requires **CORS** + **`withCredentials: true`**. |
| **`Authorization: Bearer …`** | HTTP header on the handshake (Postman, curl, some clients). |
| **`token: …`** | Plain HTTP header with the raw JWT (Postman “Headers” tab; supported for convenience). |

Token value is the **same JWT string** you use for `GET /api/v1/match/...`.

### 4.3 Allowed CORS origins (browser)

The Socket.IO server enables a fixed **allowlist** and **`credentials: true`**. Your web app origin must match one of these (scheme + host + port matter for browsers):

- `https://highphone11.com`
- `https://cricket.highphone11.com`
- `http://localhost:3000`, `http://localhost:3030`, `http://localhost:4040`
- (Some entries also include host-only forms for compatibility — see server `SOCKET_CORS_ORIGINS` in `socket.service.ts`.)

If your dev or production origin is **not** listed, **browser** connections may fail until the server adds your origin.

---

## 5. Socket.IO — connection examples

### 5.1 JavaScript / TypeScript (browser) — `auth.token`

```js
import { io } from 'socket.io-client';

const API_ORIGIN = 'https://your-api-host'; // same host as REST

const socket = io(API_ORIGIN, {
  path: '/socket.io/',
  transports: ['websocket'], // optional: prefer websocket
  auth: {
    token: userJwtString, // required
  },
});

socket.on('connect', () => {
  console.log('socket id', socket.id);
});

socket.on('connect_error', (err) => {
  console.error('Socket auth failed', err.message);
});
```

### 5.2 Browser — cookie-based JWT (same cookie as REST)

Use only if your login already sets `Authorization` cookie on the API domain and **CORS** allows your origin.

```js
const socket = io(API_ORIGIN, {
  path: '/socket.io/',
  withCredentials: true,
  // no auth.token — server reads cookie
});
```

### 5.3 React Native / mobile

Prefer **`auth: { token: '<JWT>' }`** after login. Store the JWT securely (Keychain / EncryptedSharedPreferences / secure storage). Refresh token on 401 from REST and reconnect Socket if needed.

---

## 6. Socket.IO — events (client ↔ server)

### 6.1 Client → server: `match:join`

Subscribe to live updates for a match. Send **either** `eventId` **or** terminal **`gameId`** (server resolves to `eventId` and joins room `match:<eventId>`).

**Payload (object):**

```json
{ "matchId": "<eventId or gameId>" }
```

or

```json
{ "gameId": "<gameId>" }
```

Some clients send the same JSON **as a string**; the server accepts that.

**Success path:** server joins the room and emits **`match:update`** once with the current payload.

**Failure path:** server emits **`match:error`** with a `reason` (see below).

### 6.2 Server → client: `match:update`

Full **UltraFast** match payload (same shape as REST `GET /api/v1/match/:matchId` `match` field). Subscribe in UI and update odds UI.

### 6.3 Server → client: `match:error`

```ts
{
  matchId: string | null;
  reason: string;
  hint?: string;
}
```

Typical **`reason`** values:

| Reason | Meaning |
|--------|---------|
| `missing_matchId` | `match:join` payload was empty or invalid |
| `not_found` | No match for that id in DB |
| `match_inactive` | Match not `status: true` or already declared |
| `payload_unavailable` | Cache rebuild failed (server-side) |

### 6.4 Server → client: `match:declared`

```json
{ "matchId": "<eventId>" }
```

Emitted when the match is declared / removed from the live cache; stop showing live odds for that id.

---

## 7. End-to-end client flow (recommended)

1. **Login** — obtain JWT (admin or user) and store it.
2. **REST** — `GET /api/v1/match/:eventId` with `Authorization` header or cookie to load initial snapshot.
3. **Socket** — `io(API_ORIGIN, { auth: { token } })`; wait for `connect`.
4. **Emit** — `socket.emit('match:join', { matchId: eventIdOrGameId })`.
5. **Listen** — `socket.on('match:update', handler)`, `socket.on('match:declared', handler)`, `socket.on('match:error', handler)`.
6. **Logout / session invalid** — disconnect socket; on `connect_error`, prompt re-login if message indicates auth failure.

---

## 8. Troubleshooting

| Symptom | Check |
|--------|--------|
| `connect_error` immediately | JWT missing, expired, wrong secret, user session mismatch, or admin inactive |
| **Browser** CORS error | Origin not in server allowlist; or missing `withCredentials` when using cookies |
| REST 404 for match | Match not in Redis cache (inactive/declared) — expected for closed matches |
| `match:error` `not_found` | Wrong id or match not in DB |
| `match:error` `match_inactive` | Match not eligible for live cache |

---

## 9. Related server docs

- Architecture and terminal pipeline: [`websocket.md`](../websocket.md) (sections 8–9: Redis keys, adapter, auth).
- Match betting API (if applicable): [`docs/README_Match_Betting_API.md`](./README_Match_Betting_API.md).

---

## 10. Changelog reference (for PMs / QA)

- Match cache moved from **in-memory Maps** to **Redis** (`cricket:match:uf:*`, `cricket:match:gid:*`).
- Socket.IO requires **JWT**; **multi-instance** emits use **Redis adapter** (transparent to clients).
