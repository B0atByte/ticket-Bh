# Build context is the repo root (see docker-compose.yml) so we can copy
# both the backend source and the /db migrations into one image.

# ── build stage ─────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ── runtime stage ───────────────────────────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/backend/dist ./dist
# Generated SQL migrations live at the repo root /db/migrations.
COPY db/migrations /app/db/migrations
# Apply migrations, then start the API. cwd is /app/backend so ../db resolves.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
