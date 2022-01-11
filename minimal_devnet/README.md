# Minimal Devnet

A development Wormhole network using Docker Compose that consists of 2 Ethereum nodes and 1 Guardian

## Install

Docker Compose is included with Docker Desktop, but if you are on Linux and don't have it, run the following commands (from [https://docs.docker.com/compose/install/]())

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Build

```bash
# No Solana:
docker-compose build --no-cache
# Include Solana:
docker-compose --profile solana build --no-cache
```

## Start

```bash
# No Solana:
docker-compose up
# Include Solana:
docker-compose --profile solana up
```

The network is ready when you see logs from `guardian_1`

## Stop / Teardown

`Ctrl+c`

```bash
docker-compose down
```
