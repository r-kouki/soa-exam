# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# EVENT_SERVICE_GRPC_PORT, MONGODB_URI, KAFKA_BROKERS, etc. will be passed via docker-compose

# Define the command to run your app
CMD [ "npm", "start" ] 