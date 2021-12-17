import { uint8ArrayToHex } from "@certusone/wormhole-sdk";

export const INCOMING = 0;
export const WORKING = 1;

export type StoreKey = {
  product_id: string;
  price_id: string;
};

export type StorePayload = {
  vaa_bytes: string;
};

export type StoreWorkingPayload = {
  // vaa_bytes is the same as in the StorePayload type.
  vaa_bytes: string;
  status: string;
  timestamp: string;
};

export function initWorkingPayload(): StoreWorkingPayload {
  return {
    vaa_bytes: "",
    status: "Pending",
    timestamp: Date().toString(),
  };
}

export function workingPayloadToJson(payload: StoreWorkingPayload): string {
  return JSON.stringify(payload);
}

export function workingPayloadFromJson(json: string): StoreWorkingPayload {
  return JSON.parse(json);
}

export function storeKeyFromPriceAttestation(
  pa: PythPriceAttestation
): StoreKey {
  return {
    product_id: pa.productId,
    price_id: pa.priceId,
  };
}

export function storeKeyToJson(storeKey: StoreKey): string {
  return JSON.stringify(storeKey);
}

export function storeKeyFromJson(json: string): StoreKey {
  return JSON.parse(json);
}

export function storePayloadFromVaaBytes(vaaBytes: any): StorePayload {
  return {
    vaa_bytes: uint8ArrayToHex(vaaBytes),
  };
}

export function storePayloadToJson(storePayload: StorePayload): string {
  return JSON.stringify(storePayload);
}

export function storePayloadFromJson(json: string): StorePayload {
  return JSON.parse(json);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

////////////////////////////////// Start of PYTH Stuff //////////////////////////////////////

/*
  // Pyth PriceAttestation messages are defined in wormhole/ethereum/contracts/pyth/PythStructs.sol
  // The Pyth smart contract stuff is in terra/contracts/pyth-bridge

  struct Ema {
      int64 value;
      int64 numerator;
      int64 denominator;
  }

  struct PriceAttestation {
      uint32 magic; // constant "P2WH"
      uint16 version;

      // PayloadID uint8 = 1
      uint8 payloadId;

      bytes32 productId;
      bytes32 priceId;

      uint8 priceType;

      int64 price;
      int32 exponent;

      Ema twap;
      Ema twac;

      uint64 confidenceInterval;

      uint8 status;
      uint8 corpAct;

      uint64 timestamp;
  }

0   uint32    magic // constant "P2WH"
4   u16       version
6   u8        payloadId // 1
7   [u8; 32]  productId
39  [u8; 32]  priceId
71  u8        priceType
72  i64       price
80  i32       exponent
84  PythEma   twap
108 PythEma   twac
132 u64       confidenceInterval
140 u8        status
141 u8        corpAct
142 u64       timestamp

*/

export const PYTH_PRICE_ATTESTATION_LENGTH: number = 150;

export type PythEma = {
  value: BigInt;
  numerator: BigInt;
  denominator: BigInt;
};

export type PythPriceAttestation = {
  magic: number;
  version: number;
  payloadId: number;
  productId: string;
  priceId: string;
  priceType: number;
  price: BigInt;
  exponent: number;
  twap: PythEma;
  twac: PythEma;
  confidenceInterval: BigInt;
  status: number;
  corpAct: number;
  timestamp: BigInt;
};

export const PYTH_MAGIC: number = 0x50325748;

export function parsePythPriceAttestation(arr: Buffer): PythPriceAttestation {
  return {
    magic: arr.readUInt32BE(0),
    version: arr.readUInt16BE(4),
    payloadId: arr[6],
    productId: arr.slice(7, 7 + 32).toString("hex"),
    priceId: arr.slice(39, 39 + 32).toString("hex"),
    priceType: arr[71],
    price: arr.readBigInt64BE(72),
    exponent: arr.readInt32BE(80),
    twap: {
      value: arr.readBigInt64BE(84),
      numerator: arr.readBigInt64BE(92),
      denominator: arr.readBigInt64BE(100),
    },
    twac: {
      value: arr.readBigInt64BE(108),
      numerator: arr.readBigInt64BE(116),
      denominator: arr.readBigInt64BE(124),
    },
    confidenceInterval: arr.readBigUInt64BE(132),
    status: arr.readUInt32BE(140),
    corpAct: arr.readUInt32BE(141),
    timestamp: arr.readBigUInt64BE(142),
  };
}
