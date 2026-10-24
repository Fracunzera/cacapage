# Imagen de apps/web. Se construye desde la raíz del repo:
#   docker build -f apps/web/Dockerfile .
FROM node:22.11.0-bookworm-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@10.12.1
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
RUN pnpm --filter web build

# adapter-node empaqueta todo en build/: en ejecución no hacen falta node_modules.
FROM node:22.11.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /repo/apps/web/package.json ./
COPY --from=build /repo/apps/web/build ./build
USER node
EXPOSE 3000
CMD ["node", "build"]
