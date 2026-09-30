# Two stages, because the toolchain that compiles the app is not the toolchain
# that runs it. The builder needs the whole devDependency tree: nest, tsc and
# the type packages. Shipping that tree would put a compiler, a test runner and
# every fixture in an image that is publicly described by a public repository,
# and it is the difference between 651 MB and roughly half of it. The
# production stage gets `dist/` and `npm ci --omit=dev`, and nothing else.

FROM node:24-slim AS builder

WORKDIR /usr/src/app

# Manifests alone, so this layer is reused while only sources change.
COPY package*.json ./
RUN npm ci

# nest build reads tsconfig.build.json, which extends tsconfig.json, and
# nest-cli.json. Anything else it wanted would have failed here rather than at
# run time, which is the point of doing the build in a stage.
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

FROM node:24-slim AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json ./

# --omit=optional is not cosmetic. npm 7+ installs optional *peer* dependencies,
# and typeorm declares ts-node as an optional peer, so a plain --omit=dev pulls
# in ts-node and, through it, the whole 24 MB TypeScript compiler. Nothing in
# the running service uses any of it: dist/ does not import the typeorm CLI's
# data-source, which is the only thing that imported ts-node. It also drops
# @swc/core and pg-cloudflare, which nothing in the production tree declares
# and nothing in dist references.
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# From the builder, not from the build context. The context also holds
# test/pact, scripts/ and 26 .spec.ts files, and `COPY . .` is exactly what used
# to bake them in.
COPY --from=builder /usr/src/app/dist ./dist

# The node image ships an unprivileged `node` user (uid 1000). Nothing in the
# service writes to disk, so nothing needs to be writable.
USER node

EXPOSE 3000

# Unchanged: docker-compose overrides this per service with start:auth,
# start:feeds and the rest, and that indirection is what keeps one image for all
# seven processes.
CMD ["npm", "run", "start:prod"]
