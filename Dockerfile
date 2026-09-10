# syntax=docker/dockerfile:1

# Simple single-stage image for the Node server runtime (next start).
# Runtime env vars (SUPABASE_*, JWT_SECRET, NEXT_PUBLIC_API_URL, LIVE_*)
# must be provided at runtime, e.g. `docker run -e JWT_SECRET=...`.

FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]