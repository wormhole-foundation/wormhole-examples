# Intro to Wormhole - Part 2

## Setup

Start a [minimal_devnet](../../../minimal_devnet/)

Deploy the EVM contracts

```bash
cd ethereum
npm ci
npm run migrate
npm run register
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
