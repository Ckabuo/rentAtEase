FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS pruner
RUN npm install -g turbo@2.11.7
COPY . .
RUN turbo prune @rae/web --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN npm ci
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=@rae/web

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /app /app
WORKDIR /app/apps/web
CMD ["npm", "start"]
