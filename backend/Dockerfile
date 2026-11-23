FROM node:20-bookworm-slim

# Prisma needs OpenSSL to detect the engine library.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
# Dev dependencies stay in the image: Vitest runs inside the container (see unit-test-instructions).
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Applies migrations first (fail fast on error), then starts the server.
CMD ["npm", "run", "start:prod"]
