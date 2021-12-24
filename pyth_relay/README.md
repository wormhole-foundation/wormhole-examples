In order to compile and run pyth_relay you need to install redis:

```
npm install redis
docker pull redis
```

To run the redis GUI do the following:

```
sudo apt-get install snapd
sudo snap install redis-desktop-manager
cd /var/lib/snapd/desktop/applications; ./redis-desktop-manager_rdm.desktop
```

To build the spy_guardian docker container:

```
cd pyth_relay
docker build -f Dockerfile.spy_guardian -t spy_guardian .
```

To build the pyth_relay docker container:

```
cd pyth_relay
docker build -f Dockerfile.pyth_relay -t pyth_relay .
```

To run the pyth relay containers, create a docker network:

```
docker network create relay_network
```

Run the redis container:

```
#docker run --rm -p6379:6379 --name redis-docker -d redis
docker run --rm --name redis-docker --net=host -d redis
```

Run the spy_guardian docker container in TestNet:

```
#docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/testnet/2/1 --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt' -p 7073:7073 -d spy_guardian
docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/testnet/2/1 --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt' --net=host -d spy_guardian
```

Or run the spy_guardian docker container in MainNet:

```
#docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/mainnet/2 --bootstrap /dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWL6xoqY8yU2xR2K6cP6jix4LnGSrRh94HCKiK371qUFeU' -p 7073:7073 -d spy_guardian
docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/mainnet/2 --bootstrap /dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWL6xoqY8yU2xR2K6cP6jix4LnGSrRh94HCKiK371qUFeU' --net=host -d spy_guardian

```

Then to run the pyth_relay docker container in DevNet do:

```
docker run \
-e SPY_SERVICE_HOST=0.0.0.0:7072 \
-e SPY_SERVICE_FILTERS='[{"chain_id":1,"emitter_address":"71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b"}]' \
-e TERRA_NODE_URL=http://localhost:1317 \
-e TERRA_PRIVATE_KEY='notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius' \
-e TERRA_PYTH_CONTRACT_ADDRESS=terra1wgh6adn8geywx0v78zs9azrqtqdegufuegnwep \
-e TERRA_CHAIN_ID=localterra \
-d \
--net=host \
pyth_relay
```

Then to run the pyth_relay docker container in MainNet do:

```
docker run \
-e SPY_SERVICE_HOST=0.0.0.0:7073 \
-e SPY_SERVICE_FILTERS='[{"chain_id":1,"emitter_address":"b2dd468c9b8c80b3dd9211e9e3fd6ee4d652eb5997b7c9020feae971c278ab07"}]' \
-e TERRA_NODE_URL=http://localhost:1317 \
-e TERRA_PRIVATE_KEY='notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius' \
-e TERRA_PYTH_CONTRACT_ADDRESS=terra1wgh6adn8geywx0v78zs9azrqtqdegufuegnwep \
-e TERRA_CHAIN_ID=localterra \
-d \
--net=host \
pyth_relay
```

#SPY_SERVICE_HOST=0.0.0.0:7072
#SPY_SERVICE_FILTERS=[{"chain_id":1,"emitter_address":"71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b"}]
TERRA_NODE_URL=http://localhost:1317
TERRA_PRIVATE_KEY=notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius
TERRA_PYTH_CONTRACT_ADDRESS=terra1wgh6adn8geywx0v78zs9azrqtqdegufuegnwep
TERRA_CHAIN_ID=localterra
