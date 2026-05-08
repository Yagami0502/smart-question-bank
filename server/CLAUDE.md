# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Node.js/Express backend for the MindForge / smart-question-bank app. It exposes a JSON API backed by MySQL and keeps most business logic directly inside route modules rather than in a separate service layer.

Entry point: `index.js`

## Common commands

- Install deps: `npm install`
- Run in development with reload: `npm run dev`
- Run in production mode locally: `npm start`
- Create the database schema: `mysql -u root -p < db/schema.sql`
- Find duplicate questions in the database: `node find-duplicates.js`

## Scripts with caveats

- `node scripts/import-vocabulary.js` is intended to import built-in vocabulary books, but the current script imports `../db/connection` incorrectly and will fail unless that export usage is fixed first.

## Tests and linting

`package.json` currently defines only `start` and `dev`. There are no repository-provided lint, test, or single-test commands yet.

## Required environment variables

Used directly in code:

- `JWT_SECRET` (required)
- `JWT_REFRESH_SECRET` (required)
- `DB_HOST` (optional, defaults to `localhost`)
- `DB_PORT` (optional, defaults to `3306`)
- `DB_USER` (optional, defaults to `root`)
- `DB_PASSWORD` (optional, defaults to `root`)
- `DB_NAME` (optional, defaults to `smart_question_bank`)
- `PORT` (optional, defaults to `3001`)
- `CORS_ORIGINS` (optional, comma-separated)
- `LOG_FORMAT` (optional, passed to `morgan`)

The server refuses to start if `JWT_SECRET` or `JWT_REFRESH_SECRET` is missing.

## Architecture

### App bootstrap

`index.js` wires the server together:

- loads env via `dotenv`
- creates the Express app
- applies `helmet`, `cors`, `morgan`, JSON parsing, and rate limiting
- mounts all `/api/*` routers
- exposes `/api/health`
- validates auth env and tests the MySQL connection before listening

### Database access pattern

Database access is centralized only at the connection level, not the domain level:

- `db/connection.js` exports a shared `mysql2/promise` pool
- route files import `pool` and run raw SQL inline with `pool.query(...)`
- multi-step writes sometimes open a transaction with `pool.getConnection()` + `beginTransaction()`

There is no ORM and no repository/service abstraction. When changing behavior, expect to edit SQL inside the corresponding route file.

### Middleware

Reusable cross-cutting pieces live in `middleware/`:

- `auth.js`: JWT generation/verification, optional auth, admin guard, env validation
- `rate-limit.js`: global/auth/strict rate limiters
- `validate.js`: Zod-based body/query validation wrappers

A key detail: JWT payloads are signed with `userId`, `username`, and `role`. Most authenticated routes read `req.user.userId`, but some files also use `req.user.id` or fallback logic. Check the surrounding route before normalizing auth-related code.

### Route organization

Each file in `routes/` is effectively a mini feature module that owns its HTTP handlers, SQL, and response shaping. The major API areas are:

- `auth.js`: registration, login, refresh, logout, current user, password change, session management
- `decks.js`, `questions.js`, `cards.js`: the core question-bank + spaced-repetition workflow
- `stats.js`, `wrong-questions.js`, `favorites.js`, `notes.js`, `achievements.js`, `study-plans.js`, `reminders.js`: user learning features built on top of decks/cards/questions
- `profile.js`, `settings.js`, `user-settings.js`: global settings, per-user settings, profile editing/cooldown logic. `settings.js` is mounted under `/api/settings` without auth middleware, so treat it as a global/public trust boundary when modifying it.
- `vocabulary.js`: a second large domain for vocabulary books, words, user progress, favorites, wrong words, mastered words, and articles
- `admin.js`: admin-only reporting and CRUD over users, decks, questions, and vocabulary content

If a feature touches learning state, you usually need to inspect multiple route files rather than a single module.

## Data model big picture

`db/schema.sql` defines two large domains in one database:

1. **Question bank / study system**
   - `users`, `user_sessions`, `user_stats`
   - `decks`, `questions`, `cards`, `review_logs`
   - feature tables like `favorites`, `notes`, `achievements`, `study_plans`, `reminders`, `wrong_questions`, `user_settings`

2. **Vocabulary system**
   - `vocabulary_books`, `words`
   - per-user progress tables like `user_vocabularies`, `word_progress`, `wrong_words`, `favorite_words`, `mastered_words`, `vocabulary_settings`
   - `articles`

The app stores most timestamps as Unix epoch milliseconds (`Date.now()`), not SQL datetime columns.

## Important implementation patterns

- IDs are generally UUID strings via `uuid.v4()`.
- JSON columns/fields are often stringified on write and parsed manually on read.
- Ownership checks are commonly enforced with helper queries in each route file rather than via shared utilities.
- API responses are not fully standardized; some handlers return `{ success: true }`, others return raw arrays/objects, and others use `{ error: ... }`.

## Vocabulary import assumptions

`scripts/import-vocabulary.js` expects source JSON files at paths relative to the server directory:

- `../../CET4_T.json`
- `../../CET6_T.json`

If those files are missing, the import script skips them.
