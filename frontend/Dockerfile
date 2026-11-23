FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

EXPOSE 5173

# v1 runs the Vite server bound to 0.0.0.0 (also set in vite.config.ts) so the host can reach it.
CMD ["npm", "run", "dev"]
