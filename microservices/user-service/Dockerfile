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

# Make port available to the world outside this container
# The USER_SERVICE_PORT will be passed as an environment variable in docker-compose
# EXPOSE ${USER_SERVICE_PORT} 
# We typically don't EXPOSE here if it's managed by docker-compose port mapping and the variable nature is complex for EXPOSE.
# The application itself listens on USER_SERVICE_PORT.

# Define the command to run your app
CMD [ "npm", "start" ] 