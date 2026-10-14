FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV STRAPI_TELEMETRY_DISABLED=true
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production STRAPI_TELEMETRY_DISABLED=true HOST=0.0.0.0 PORT=1337
WORKDIR /opt/app
COPY --from=build --chown=node:node /opt/app ./
RUN mkdir -p public/uploads && chown -R node:node public/uploads
USER node
EXPOSE 1337
CMD ["npm", "run", "start"]
