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
@docker run --rm -p6379:6379 --name redis-docker -d --net=host redis
docker run --rm --name redis-docker -d --net=host redis
```

Run the spy_guardian docker container in TestNet:

```
docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/testnet/2/1 --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt' -p 7073:7073 --net=host spy_guardian
```

Or run the spy_guardian docker container in MainNet:

```
#docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/mainnet/2 --bootstrap /dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWL6xoqY8yU2xR2K6cP6jix4LnGSrRh94HCKiK371qUFeU' -p 7073:7073 --net=host spy_guardian
docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/mainnet/2 --bootstrap /dns4/wormhole-mainnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWL6xoqY8yU2xR2K6cP6jix4LnGSrRh94HCKiK371qUFeU' --net=host spy_guardian

```

Then run the pyth_relay docker container:

```
docker run --net=host pyth_relay
```
