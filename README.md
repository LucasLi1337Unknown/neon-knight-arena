# Neon Knight Arena

[Play Neon Knight Arena](https://neon-knight-arena.vercel.app/)

A futuristic chess site with five AI tiers, an interactive board, with live human multiplayer and a shared chess community.

## Available now

- Five worker-based AI levels (random to iterative depth-four minimax; these are relative tiers, not certified Elo ratings).
- Legal moves, check/checkmate, castling, en passant, underpromotion, automatic draws, legal-move hints, board flipping, undo, and PGN export.
- Persistent player profiles, private recovery keys, avatars, bios, and saved AI training progress.
- Human matches through a shared lobby or invite links, saved match history, resignation, and draw offers.
- Shared global chat, community posts and replies, player cards, reporting, and browser-local muting.
- Responsive dark UI with cyan/violet accents and keyboard-operable board squares.

## Backend

The chess backend is active on Supabase project `tunuexbkkakiawsyanqu`, approved by the owner on October 31, 2026. `schema.sql` records the deployed schema; `server.ts` is deployed as `neon-knight-api` with JWT verification enabled. `config.js` contains only the public anon gateway key. All eight chess tables deny direct anonymous/authenticated access, with server-side authorization handled by the Edge Function.

Service credentials are read only from the Edge Function environment and are never put in the frontend or repository. `schema.sql` is a historical setup file; do not reapply it to the existing tables.

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

`npm test` covers chess legality, checkmate, castling, en passant, promotion, stalemate, all AI tiers, and mate-in-one. A local database mock exercises backend recovery/auth, game joining, turn and legality enforcement, version conflicts, a complete checkmate, draw offers, chat ownership, content limits, posts, and replies. Live integration tests also verified two distinct player identities, profile recovery, game joining, rejected illegal/out-of-turn moves, a complete checkmate, shared chat delivery, rate limits, posts, and replies. Browser testing verified profile creation, AI replies, keyboard controls, undo, and live community connectivity.

Chess rules are provided by chess.js 1.4.0 (BSD-2-Clause). See `THIRD_PARTY_LICENSES.txt`.
