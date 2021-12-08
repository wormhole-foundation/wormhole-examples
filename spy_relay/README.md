In order to compile spy_relay you need to do:
"npm install redis"

In order to run spy_relay successfully you need to do:
"docker pull redis"
The above will grab the docker for redis.
In order to run that docker use a command similar to:
"docker run --rm -p6379:6379 --name redis-docker -d redis"

