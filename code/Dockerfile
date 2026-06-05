# Quorumchain deployable node — zero runtime deps, runs the TS entrypoint via Node type-stripping.
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY pinned-keyring.json ./pinned-keyring.json
ENV QRM_NODE_DATA=/data QRM_NODE_PORT=8787
VOLUME /data
EXPOSE 8787
# tokens are injected at runtime (never baked in): QRM_SUBMIT_TOKEN / QRM_ADMIN_TOKEN
CMD ["node", "src/run-node.ts"]
