# Blueprint for the independent repository; not a built service image.
ARG NODE_IMAGE=node:24.22.0-trixie-slim@sha256:a6155384446670e9719bdc4fd0ebe4d4b29fb32a8d6aa523da3547a6cfbcf22c

FROM ${NODE_IMAGE} AS tooling
ARG PNPM_VERSION=11.10.0
RUN npm install --global "pnpm@${PNPM_VERSION}"
WORKDIR /app

FROM tooling AS build
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./
RUN pnpm install --frozen-lockfile
COPY src ./src
COPY tools ./tools
RUN pnpm run build

FROM tooling AS production-dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV RELAY_CONFIG=/etc/oauth-relay/config.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["dist/server.js"]
