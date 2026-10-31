# Neon Knight Arena

[Play Neon Knight Arena](https://neon-knight-arena.vercel.app/)

A futuristic chess site with five AI tiers, an interactive board, and a prepared human multiplayer/community backend.

## Available now

- Five worker-based AI levels (random to iterative depth-four minimax; these are relative tiers, not certified Elo ratings).
- Legal moves, check/checkmate, castling, en passant, underpromotion, automatic draws, legal-move hints, board flipping, undo, and PGN export.
- Local browser profile and saved AI training progress.
- Responsive dark UI with cyan/violet accents and keyboard-operable board squares.

## Awaiting database approval

The live site explicitly labels human matches, persistent online profiles, global chat, and community posts/replies as pending. They are implemented in source but not enabled. No database migration or Edge Function has been applied.

Prepared backend: `schema.sql` and `server.ts`. The intended existing Supabase project is `tunuexbkkakiawsyanqu` (Personal Data Project Subjective). Applying either requires explicit owner approval. Do not apply to an unrelated project silently.

After approval, apply the schema, deploy `server.ts` as `neon-knight-api` with JWT verification enabled, set the public anon gateway key in `config.js` and `ready:true`, build, and deploy. Service credentials are read only from the Edge Function environment and are never put in the frontend or repository.

Online profiles use a private 256-bit recovery key. The server stores only its SHA-256 hash. Losing the key and browser storage loses access. Keep it private; anyone with the key can access the profile. There is no email verification, password reset, ranking certification, or anti-engine-cheating system.

The backend enforces membership, legal chess moves, active turns, version-based concurrency, chat/post size limits, ownership for deletion, and rate limits. Reports are stored for owner review; mutes are browser-local. Games are casual and untimed. Community statistics summarize the recent 150 fetched games.

## Develop

Requires Node 22 or newer.

```
npm ci
npm test
npm run build
npx serve dist
```

Vercel: framework Other, output `dist`, build `npm run build`, install `npm ci`. Included `vercel.json` sets these explicitly. Pin dependencies via `package-lock.json`.

## Verification

`npm test` covers chess legality, checkmate, castling, en passant, promotion, stalemate, all AI tiers, and mate-in-one. A local database mock exercises backend recovery/auth, game joining, turn and legality enforcement, version conflicts, a complete checkmate, draw offers, chat ownership, content limits, posts, and replies. Real cross-device multiplayer still needs live verification after backend approval.

Chess rules are provided by chess.js 1.4.0 (BSD-2-Clause). See `THIRD_PARTY_LICENSES.txt`.
