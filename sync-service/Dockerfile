# --------------------
# Build stage
# --------------------
FROM node:22-alpine AS build-stage

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --------------------
# Production stage
# --------------------
FROM node:22-alpine AS production

# Install mongodb-tools for mongodump (needed for backups)
RUN apk add --no-cache mongodb-tools

ENV NODE_ENV=production
ENV TZ=Asia/Kolkata

WORKDIR /app

COPY --from=build-stage /app/dist ./dist
COPY --from=build-stage /app/package.json ./

RUN npm install --omit=dev

# Create directories
RUN mkdir -p /app/logs /backup

EXPOSE 3099

CMD ["node", "dist/index.js"]
