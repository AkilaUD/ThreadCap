FROM node:22-bookworm-slim AS build

ENV CI=true

RUN npm install -g pnpm@12.4.2

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @threadcap/web build

FROM nginx:1.27-alpine

COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80