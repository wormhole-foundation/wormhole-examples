# Minimal Devnet

A development Wormhole network using Docker Compose that consists of 2 Ethereum nodes and 1 Guardian

## Build

```bash
docker-compose build
```

## Start

```bash
docker-compose up
```

The network is ready when you see logs from `guardian_1`

## Stop / Teardown

`Ctrl+c`

```bash
docker-compose down
```
