FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY generate-events.ts ./

CMD ["npx", "tsx", "generate-events.ts"]
