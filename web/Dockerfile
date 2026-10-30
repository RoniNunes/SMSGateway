FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL="file:./dev.db" npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=80
ENV DATABASE_URL="file:/data/smsgateway.db"

RUN apk add --no-cache wget openssl
RUN mkdir -p /data

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./

EXPOSE 80
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
  CMD wget -qO- http://127.0.0.1:80/health || exit 1

CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && npx tsx server.ts"]