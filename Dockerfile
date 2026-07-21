FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY boa-daemon.js ./
COPY bin ./bin
COPY src ./src
COPY public ./public
COPY integrations ./integrations
COPY test ./test
COPY dist ./dist
ENV NODE_ENV=production PORT=8787 BOA_SITE_HOST=0.0.0.0
EXPOSE 8787
CMD ["npm", "start"]
