FROM node:20-alpine AS base
WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=3000

FROM base AS deps
RUN apk update && apk add --no-cache ffmpeg python3 make g++ libc6-compat
COPY package*.json ./
RUN npm ci

# Build the Next.js app (needs dev deps)
FROM deps AS builder
COPY . .
RUN npm run build

# Install only production deps for the runtime image
FROM base AS prod-deps
RUN apk update && apk add --no-cache ffmpeg python3 make g++ libc6-compat
COPY package*.json ./
RUN npm ci --omit=dev

# Runtime image
FROM base AS runner
ENV NODE_ENV=production
RUN apk update && apk add --no-cache ffmpeg libc6-compat
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p data

EXPOSE 3000
CMD ["npm", "start"]
