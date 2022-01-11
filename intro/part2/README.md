# Intro to Wormhole - Part 2

## Setup

Start a [minimal_devnet](../../../minimal_devnet/)

### Deploy the EVM contracts

```bash
cd ethereum
npm ci
npm run migrate
npm run register    -- Run this after all chain contracts are deployed.
```

### Deploy the Solana contracts and generate wasm (for UI)

```bash
cd solana
EMITTER_ADDRESS="11111111111111111111111111111115" cargo build-bpf
# if running the local (tilt) devnet
# if kubectl was not found - use "minikube kubectl -- " in place of "kubectl "
kubectl cp -c devnet target/deploy/messenger_solana.so solana-devnet-0:/usr/src/
kubectl cp -c devnet id.json solana-devnet-0:/usr/src/
     # ^ this file needs to be copied only once per Tilt run.
kubectl exec -c devnet solana-devnet-0 -- solana program deploy -u l --output json -k /usr/src/id.json /usr/src/messenger_solana.so > ../ui/src/contract-addresses/solana.json
# else if running the minimal-devnet
solana program deploy -u l --output json -k id.json target/deploy/messenger_solana.so > ../ui/src/contract-addresses/solana.json
# Generate wasm for JS code (Tilt and minimal-devnet)
EMITTER_ADDRESS="11111111111111111111111111111115" wasm-pack build --target bundler -d bundler -- --features wasm
EMITTER_ADDRESS="11111111111111111111111111111115" wasm-pack build --target nodejs -d nodejs -- --features wasm
node scripts/register_chains.js    -- Run this after all chain contracts are deployed.
```

BUG WORKAROUND FOR SOLANA:
And in messenger_solana_bg.js following code needs to commented out for now:

```
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_systeminstruction_free(ptr);
    }
```

Run the UI

```bash
cd ui
npm ci
npm run typechain
npm start
```

# Tech

### Chain side

The Ethereum smart contract is in
`ethereum/contracts/Messenger.sol`
Added function: `receiveBytes`. This function receives VAA from UI and verifies it. There are three checks:

1. Verify Wormhole signatures. This is done via Wormhole SDK `parseAndVerifyVM` method.
2. Verify that VAA was emitted from one of known contract addresses. (Messenger on one of chains in this case). We register all addresses with each Smart contract in `npm run register` script, after all contracts have been migrated.
3. Check if this VAA was already processed. This is done by checking if VAA hash has been already processed.

### Client side

Calling code is in
`ui/src/App.tsx`
`processClickHandler`
All work is done in call `Messenger.receiveBytes`.
Call either returns, which is indication that VAA was verified, or it trows exception if verification fails in one of the steps above.
