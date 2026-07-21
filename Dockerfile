# Use the official Playwright Python image to ensure all browser dependencies are present
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Install Node.js (v18)
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium

# Copy Node dependencies
COPY package*.json ./
RUN npm install

# Copy frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy the rest of the application
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Expose port (Render sets process.env.PORT automatically)
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["npm", "start"]
