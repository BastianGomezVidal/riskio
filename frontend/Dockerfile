FROM node:24-slim AS build
WORKDIR /build

# Same rule as the API URL: compose passes these, and Vite only sees a VITE_ var
# that is both declared and exported into the build stage.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_OTEL_EXPORTER_OTLP_ENDPOINT
ENV VITE_OTEL_EXPORTER_OTLP_ENDPOINT=$VITE_OTEL_EXPORTER_OTLP_ENDPOINT

# Inactivity timeout and the warning that fires before it. These are read at
# build time by src/auth/session-context.tsx, so they are compile-time values
# and not runtime environment: changing them needs a rebuild, which is why they
# live here rather than in the nginx stage. Without this pair a container
# cannot change them and the built-in defaults apply to every deployment.
ARG VITE_IDLE_TIMEOUT_MS
ENV VITE_IDLE_TIMEOUT_MS=$VITE_IDLE_TIMEOUT_MS
ARG VITE_IDLE_WARNING_MS
ENV VITE_IDLE_WARNING_MS=$VITE_IDLE_WARNING_MS

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build


FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html