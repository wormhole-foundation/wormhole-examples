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

Run the spy_guardian docker container in TestNet:

```
docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/testnet/2/1 --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt' --net=host -d spy_guardian
```

Or run the spy_guardian docker container in MainNet:

```
docker run -e ARGS='--spyRPC [::]:7074 --network /wormhole/mainnet/2 --bootstrap /dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWL6xoqY8yU2xR2K6cP6jix4LnGSrRh94HCKiK371qUFeU' --net=host -d spy_guardian

```

Then to run the pyth_relay docker container using a config file called ${HOME}/pyth_relay/env and logging to directory ${HOME}/pyth_relay/logs, do the following:

```
docker run \
--volume=${HOME}/pyth_relay:/var/pyth_relay \
-e PYTH_RELAY_CONFIG=/var/pyth_relay/env \
--net=host \
-d \
pyth_relay
```
