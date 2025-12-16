FROM node:20-alpine AS base
WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=3000

# ----------------------------
# Dependencies (dev + build deps)
# ----------------------------
FROM base AS deps
RUN set -eux; \
    ALPINE_V="$(cut -d. -f1,2 /etc/alpine-release)"; \
    echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_V}/community" >> /etc/apk/repositories; \
    apk add --no-cache \
      ffmpeg \
      libc6-compat \
      python3 \
      make \
      g++
COPY package*.json ./
RUN npm ci

# ----------------------------
# Build
# ----------------------------
FROM deps AS builder
COPY . .
RUN npm run build

# ----------------------------
# Production deps only (node_modules for runtime)
# ----------------------------
FROM base AS prod-deps
RUN set -eux; \
    ALPINE_V="$(cut -d. -f1,2 /etc/alpine-release)"; \
    echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_V}/community" >> /etc/apk/repositories; \
    apk add --no-cache --virtual .build-deps \
      python3 \
      make \
      g++; \
    apk add --no-cache \
      ffmpeg \
      libc6-compat
COPY package*.json ./
RUN npm ci --omit=dev
RUN apk del .build-deps

# ----------------------------
# Runtime
# ----------------------------
FROM base AS runner
ENV NODE_ENV=production

RUN set -eux; \
    ALPINE_V="$(cut -d. -f1,2 /etc/alpine-release)"; \
    echo "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_V}/community" >> /etc/apk/repositories; \
    apk add --no-cache ffmpeg libc6-compat

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p data

EXPOSE 3000
CMD ["npm", "start"]
