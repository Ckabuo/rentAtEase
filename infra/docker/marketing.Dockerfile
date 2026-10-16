FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS pruner
RUN npm install -g turbo@2.11.7
COPY . .
RUN turbo prune @rae/marketing --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=@rae/marketing

FROM nginx:1.29-alpine AS runner
COPY --from=installer /app/apps/marketing/out /usr/share/nginx/html
