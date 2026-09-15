FROM node:22-alpine AS build

WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .

# The API base URL is baked in at image build time and is the only
# coupling the web app has with the backend.
ARG VITE_API_URL=http://backend-api:3000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]