# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM dependencies AS build
ARG VITE_STREAMING_ASR=

# Prepare the pinned, checksum-verified AI runtime before copying application
# source. Docker can reuse this expensive layer while the UI changes.
COPY scripts/prepare-assets.mjs ./scripts/prepare-assets.mjs
COPY scripts/prepare-conversation-assets.mjs scripts/conversation-assets.lock.json ./scripts/
COPY scripts/prepare-moonshine-assets.mjs scripts/moonshine-streaming-vi.lock.json ./scripts/
COPY public ./public
RUN npm run assets:prepare
RUN npm run assets:conversation
RUN if [ "$VITE_STREAMING_ASR" = "moonshine" ]; then npm run assets:moonshine; fi

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY scripts/moonshine-runtime-profiles.lock.json ./scripts/
COPY scripts/verify-assets.mjs scripts/product-budget.json scripts/prune-candidate-bundle.mjs ./scripts/

ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_ANON_KEY=
ARG VITE_BUILD_ID=
ARG VITE_AI_PROFILE=baseline
ENV VITE_STREAMING_ASR=${VITE_STREAMING_ASR}
ARG VITE_TEXT_WASM_THREADS=1
ARG VITE_MOONSHINE_RUNTIME=official
ENV VITE_MOONSHINE_RUNTIME=${VITE_MOONSHINE_RUNTIME}
ENV VITE_TEXT_WASM_THREADS=${VITE_TEXT_WASM_THREADS}
ENV VITE_BUILD_ID=${VITE_BUILD_ID}
ENV VITE_AI_PROFILE=${VITE_AI_PROFILE}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run assets:verify && npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY --chmod=755 docker/35-signemo-immutable-assets.sh /docker-entrypoint.d/35-signemo-immutable-assets.sh
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/signemo-security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
