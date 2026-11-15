FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src

RUN npx javascript-obfuscator src \
      --output dist \
      --compact true \
      --control-flow-flattening true \
      --dead-code-injection true \
      --string-array true \
      --string-array-encoding base64 \
      --self-defending true

RUN npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
