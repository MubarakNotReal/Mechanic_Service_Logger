# syntax=docker/dockerfile:1

FROM node:20 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# copy package metadata and node_modules (including dev deps for migrations)
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# create writable directories
RUN mkdir -p /app/uploads

COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 5000

CMD ["/app/entrypoint.sh"]
