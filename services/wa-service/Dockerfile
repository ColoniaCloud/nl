FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
VOLUME /app/auth_states
EXPOSE 3002
CMD ["node", "dist/index.js"]
