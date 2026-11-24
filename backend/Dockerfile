FROM node:20-bookworm-slim

# Prisma needs OpenSSL to detect the engine library.
# postgresql-client-16 (psql, pg_dump, pg_restore) comes from the PGDG repository: Debian bookworm only
# ships client 15, and pg_dump 15 refuses to dump a PostgreSQL 16 server. The repository key is verified by apt.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && . /etc/os-release \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update -y \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
# Dev dependencies stay in the image: Vitest runs inside the container (see unit-test-instructions).
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build \
    && chmod +x scripts/start-prod.sh

ENV NODE_ENV=production
EXPOSE 3000

# scripts/start-prod.sh: backup before pending migrations (fail fast), apply migrations, start the server.
CMD ["npm", "run", "start:prod"]
