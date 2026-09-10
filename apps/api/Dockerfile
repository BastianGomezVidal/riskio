FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the API
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]