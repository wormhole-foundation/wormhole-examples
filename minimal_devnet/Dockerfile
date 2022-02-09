# Bare bones linux
FROM alpine:3.8 AS checkout

# Update apline linux and add git.
RUN apk update && apk upgrade && apk add --no-cache git openssh

# Clone the wormhole repo.
RUN mkdir /app && cd /app && git clone https://github.com/certusone/wormhole.git . && git checkout tags/v2.6.0

# syntax=docker.io/docker/dockerfile:experimental@sha256:de85b2f3a3e8a2f7fe48e8e84a65f6fdd5cd5183afa6412fff9caa6871649c44
FROM docker.io/golang:1.17.0@sha256:06e92e576fc7a7067a268d47727f3083c0a564331bfcbfdde633157fc91fb17d AS go-tools

COPY --from=checkout /app /app

RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
	cd /app/tools && CGO_ENABLED=0 ./build.sh

# syntax=docker.io/docker/dockerfile:experimental@sha256:de85b2f3a3e8a2f7fe48e8e84a65f6fdd5cd5183afa6412fff9caa6871649c44
FROM docker.io/golang:1.17.0@sha256:06e92e576fc7a7067a268d47727f3083c0a564331bfcbfdde633157fc91fb17d AS go-build

COPY --from=go-tools /app /app

RUN --mount=type=cache,target=/root/.cache \
	cd /app && \
	tools/bin/buf lint && \
	tools/bin/buf generate

# RUN cp /app/node/pkg/proto /app/pkg/proto

# syntax=docker.io/docker/dockerfile:experimental@sha256:de85b2f3a3e8a2f7fe48e8e84a65f6fdd5cd5183afa6412fff9caa6871649c44
FROM docker.io/golang:1.17.0@sha256:06e92e576fc7a7067a268d47727f3083c0a564331bfcbfdde633157fc91fb17d

WORKDIR /app/node

COPY --from=go-build /app /app

RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
  cd tools/ && go build -mod=readonly -o /dlv github.com/go-delve/delve/cmd/dlv

RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
  go build -race -gcflags="all=-N -l" -mod=readonly -o /guardiand github.com/certusone/wormhole/node

RUN wget https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh && chmod +x wait-for-it.sh