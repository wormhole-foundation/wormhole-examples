import {
  connectToTerra,
  queryTerra,
  relayTerra,
  TerraConnectionData,
} from "./terra";

export type ConnectionData = {
  terraData: TerraConnectionData;
};

export function connectRelayer(): ConnectionData {
  var td = connectToTerra();
  return { terraData: td };
}

export async function relay(
  signedVAA: string,
  connectionData: ConnectionData
): Promise<any> {
  return await relayTerra(connectionData.terraData, signedVAA);
}

export async function query(productIdStr: string): Promise<any> {
  var terraData = connectToTerra();
  return await queryTerra(terraData, productIdStr);
}
