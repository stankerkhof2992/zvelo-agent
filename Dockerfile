# Stage 1 — Frontend bouwen
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2 — Productie image
FROM node:22-bookworm-slim
WORKDIR /app

# Backend dependencies (alleen productie)
# npm install ipv npm ci: pakt altijd de correcte platform-binaries (bv. Sharp Linux vs Windows)
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Backend broncode
COPY backend/ ./backend/

# Frontend build van stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Data mappen aanmaken (worden overschreven door Render disk op /data)
RUN mkdir -p /data/assets/generated /data/assets/mockups /data/assets/products

ENV NODE_ENV=production
ENV PORT=10000
ENV DB_PATH=/data/zvelo.db
ENV ASSETS_PATH=/data/assets

EXPOSE 10000

# --experimental-sqlite is nodig op Node 22 voor de ingebouwde SQLite module
CMD ["node", "--experimental-sqlite", "--disable-warning=ExperimentalWarning", "backend/server.js"]
