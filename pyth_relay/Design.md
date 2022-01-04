# Overview

The pyth_relay program is designed to listen to Pyth messages published on Solana and relay them to other chains.
Although in its initial release, the only supported destination chain is Terra, the design supports publishing to multiple chains.

<p>
The relayer listens to the spy_guardian for signed VAA messages. It can be configured to only request specific emitters, so that only Pyth messages get forwarded.
<p>
When the relayer receives messages from the spy, it drops redundant messages based on sequence numbers, verifies the message is a Pyth message, and relays the pyth
messages to Terra.

# Operational Details

The relayer can be run as a docker image. Additionally, you need to have an instance of the spy guardian running, which can be started using a docker image.

<p>
The relayer is configured using an env file, as specified by the PYTH_RELAY_CONFIG environment variable. Please see the env.samples file in the source directory for
valid variables.
<p>
The relayer can be configured to log to a file in the directory specified by the LOG_DIR environment variable. If the variable is not specified, it logs to the console.
<p>
The log level can be controlled by the LOG_LEVEL environment variable, where info is the default. The valid values are debug, info, warn, and error.

# Design Details

The relayer code is divided into separate source files, based on functionality. The main entry point is index.ts. It invokes code in the other files as follows.

## listener.ts

The listener code parses the emitter filter parameter, which may consist of none, one or more chain / emitter pairs. If any filters are specified, then only VAAs from those emitters will be processed. The listener then registers those emitters with the spy guardian via RPC callback.

<p>
When the listener receives a VAA from the spy, it verifies that it has not already been seen, based on the sequence number. This is necessary since there are multiple guardians signing and publishing the same VAAs. It then validates that it is a Pyth message. All Pyth payloads start with P2WH. If so, it invokes the postEvent method on the worker to forward the VAA for publishing.

## worker.ts

The worker code is responsible for taking VAAs to be published from the listener and passing them to the relay code for relaying to Terra.

<p>
The worker uses a map of pending events, and a condition variable to signal that there are events waiting to be published, and a map of the latest state of each Pyth price.
The worker protects all of these objects with a mutex.
<p>
The worker maintains performance metrics to be published by the Prometeus interface.
<p>
The worker also provides methods to query the status of the wallet being used for relaying, the current status of all maintained prices, and can query Terra for the current
data for a given price. These are used by the REST interface, if it is enabled in the config.

## main.ts and terra.ts

This is the code that actually communicates with the Terra block chain. It takes configuration data from the env file, and provides methods to relay a Pyth message, query the wallet balance, and query the current data for a given price.

## promHelper.ts

Prometheus is being used as a framework for storing metrics. Currently, the following metrics are being collected:

- The last sequence number sent
- The total number of successful relays
- The total number of failed relays
- A histogram of transfer times
- The current wallet balance
- The total number of VAAs received by the listener

All the above metrics can be viewed at http://localhost:8081/metrics

<p>
The port 8081 is the default.  The port can be specified by the `PROM_PORT` tunable in the env file.
<p>
This file contains a class named `PromHelper`.  It is an encapsulation of the Prometheus API.

## helpers.ts

This contains an assortment of helper functions and objects used by the other code, including logger initialization and parsing of Pyth messages.
