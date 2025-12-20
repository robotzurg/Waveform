# ---------- build ----------
FROM node:18-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y \
  python3 \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ---------- runtime ----------
FROM node:18-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
  libcairo2 \
  libpango-1.0-0 \
  libjpeg62-turbo \
  libgif7 \
  librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

# copy everything that exists in /app from build stage
COPY --from=build /app /app

CMD ["node", "index.js"]
