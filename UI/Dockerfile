# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# ── Stage 2: Build the Next.js app ──
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Bake in the public env vars at build time
ARG NEXT_PUBLIC_AGENT_API
ARG NEXT_PUBLIC_HR_USER_EMAIL
ENV NEXT_PUBLIC_AGENT_API=$NEXT_PUBLIC_AGENT_API
ENV NEXT_PUBLIC_HR_USER_EMAIL=$NEXT_PUBLIC_HR_USER_EMAIL

RUN npm run build

# ── Stage 3: Production runner ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed to run
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
