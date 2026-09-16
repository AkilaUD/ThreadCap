FROM node:22-bookworm-slim

ENV CI=true
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install -g pnpm@12.4.2

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@threadcap/api...

ENV NODE_ENV=production

EXPOSE 8080
CMD ["node", "apps/api/dist/main.js"]