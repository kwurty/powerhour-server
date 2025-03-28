# Fetching the minified node image on apline linux
FROM node:slim

# Setting up the work directory
WORKDIR /app

# Declaring env
ENV NODE_ENV development

# COPY package.json
COPY package.json /app

# Installing dependencies
RUN npm install

# Copying all the files in our project
COPY . /app

# Exposing server port
EXPOSE 3000

# Starting our application
CMD [ "npm", "run", "start" ]