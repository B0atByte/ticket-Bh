# Phase 1: run the Vite dev server so the frontend service comes up.
# Production build (nginx/static) is addressed in Phase 5.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
