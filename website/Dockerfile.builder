FROM node:22-bookworm-slim
WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV ASTRO_TELEMETRY_DISABLED=1
RUN mkdir -p /site .content && chown -R node:node /opt/app /site
USER node
EXPOSE 4322
CMD ["node", "scripts/builder.mjs"]
