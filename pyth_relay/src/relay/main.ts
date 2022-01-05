import {
  connectToTerra,
  queryBalanceOnTerra,
  queryTerra,
  relayTerra,
  TerraConnectionData,
} from "./terra";

export type ConnectionData = {
  terraData: TerraConnectionData;
};

import { logger } from "../helpers";

export function connectRelayer(): ConnectionData {
  var td = connectToTerra();
  return { terraData: td };
}

export async function relay(
  signedVAAs: Array<string>,
  connectionData: ConnectionData
): Promise<any> {
  return await relayTerra(connectionData.terraData, signedVAAs);
}

export async function query(
  productIdStr: string,
  priceIdStr: string
): Promise<any> {
  var result: any;
  try {
    var terraData = connectToTerra();
    result = await queryTerra(terraData, productIdStr, priceIdStr);
  } catch (e) {
    logger.error("query failed: %o", e);
    result = "Error: " + e.message;
  }

  return result;
}

export async function queryBalance(
  connectionData: ConnectionData
): Promise<number> {
  var balance: number = NaN;
  try {
    balance = await queryBalanceOnTerra(connectionData.terraData);
  } catch (e) {
    logger.error("balance query failed: %o", e);
  }

  return balance;
}
