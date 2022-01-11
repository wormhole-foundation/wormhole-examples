# Wait for node to start
echo "waiting for node 26657"
while ! /bin/netcat -zv localhost 26657; do
  sleep 1
done

# Wait for first block
echo "waiting for block"
while [ $(curl localhost:26657/status -ks | jq ".result.sync_info.latest_block_height|tonumber") -lt 1 ]; do
  sleep 1
done

echo "Going to sleep 2s"
sleep 2
npm ci && node deploy.js

echo "Got back from deploy.js"
#sleep infinity
