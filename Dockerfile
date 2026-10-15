FROM node:24-bookworm-slim

# Install system prerequisites: git (to clone pinned kenya-law-mcp), curl, unzip, ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH
RUN curl -fsSL https://bun.sh/install | bash

WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock tsconfig.json tsconfig.build.json ./
COPY web/package.json web/tsconfig.json web/vite.config.ts web/
COPY scripts/ scripts/

# Copy application sources, fixtures and web client
COPY fixtures/ fixtures/
COPY src/ src/
COPY web/ web/

# Run setup to lock dependencies, checkout pinned KenyaLaw MCP, and compile backend and web dist
RUN bun run setup
RUN bun run build

ENV PORT=10000
ENV HOST=0.0.0.0
EXPOSE 10000

CMD ["node", "dist/server.js"]
