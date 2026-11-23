# syntax=docker/dockerfile:1
# Multi-stage: deps de build e de produção em estágios separados; a imagem final só leva dist/, drizzle/ e node_modules de produção.
# slim (glibc), não alpine: bcrypt e @confluentinc/kafka-javascript são nativos e têm binário pronto para glibc.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:${NODE_VERSION}-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# migrations aplicadas no startup, caminho relativo ao WORKDIR
COPY drizzle ./drizzle
COPY package.json ./
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
