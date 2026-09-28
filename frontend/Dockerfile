FROM node:24-slim AS build
WORKDIR /build

# Same rule as the API URL: compose passes these, and Vite only sees a VITE_ var
# that is both declared and exported into the build stage.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_OTEL_EXPORTER_OTLP_ENDPOINT
ENV VITE_OTEL_EXPORTER_OTLP_ENDPOINT=$VITE_OTEL_EXPORTER_OTLP_ENDPOINT

# compose passes this as a build arg. Vite only sees env vars that are declared
# (ARG) and exported into the build stage (ENV); without both it silently falls
# back to the localhost default in src/api/client.ts.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build


FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html