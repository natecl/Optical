FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /workspace/server

COPY server/package*.json ./
RUN npm ci --include=dev --omit=optional && npm cache clean --force

COPY server/ ./
COPY types/ ../types/

EXPOSE 8080
USER node

CMD ["npm", "run", "start"]
