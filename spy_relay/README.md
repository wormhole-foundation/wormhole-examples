In order to compile spy_relay you need to do:

```
npm ci

```

In order to run spy_relay successfully you need to do:

```
docker pull redis
```

The above will grab the docker for redis.
In order to run that docker use a command similar to:

```
docker run --rm -p6379:6379 --name redis-docker -d redis
```

To run the redis GUI do the following:

```
sudo apt-get install snapd
sudo snap install redis-desktop-manager
cd /var/lib/snapd/desktop/applications; ./redis-desktop-manager_rdm.desktop
```

To build the spy / guardian docker container:

```
cd spy_relay
docker build -f Dockerfile -t guardian .
```

To run the docker image in TestNet:

```
docker run -e ARGS='--spyRPC [::]:7073 --network /wormhole/testnet/2/1 --bootstrap /dns4/wormhole-testnet-v2-bootstrap.certus.one/udp/8999/quic/p2p/12D3KooWBY9ty9CXLBXGQzMuqkziLntsVcyz4pk1zWaJRvJn6Mmt' -p 7073:7073 guardian
```

To run spy_relay:

```
npm run spy_relay
```
