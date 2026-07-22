# Use official lightweight Node.js image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy root Node dependencies
COPY package*.json ./
RUN npm install --production=false

# Copy frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy the rest of the application
COPY . .

# Pull the API key from Render's dashboard into the build phase
ARG VITE_TMDB_API_KEY
ENV VITE_TMDB_API_KEY=$VITE_TMDB_API_KEY

# Build the frontend (Vite will inject VITE_TMDB_API_KEY if present in environment)
RUN cd frontend && npm run build

# Expose port (Render sets process.env.PORT automatically)
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Start server
CMD ["npm", "start"]
