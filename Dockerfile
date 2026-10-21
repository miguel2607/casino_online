# ---------- 1) Compila el frontend ----------
FROM node:22-alpine AS client
WORKDIR /app
COPY shared ./shared
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci
COPY client ./client
RUN cd client && npm run build

# ---------- 2) Imagen final: API + frontend compilado ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server/src ./server/src
COPY shared ./shared
COPY --from=client /app/client/dist ./client/dist

WORKDIR /app/server
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" || exit 1
CMD ["node", "src/index.js"]
