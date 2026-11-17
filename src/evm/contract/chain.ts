import * as settings from "../../settings";
import * as utils from "../../utils";
import { JsonRpcProvider, Transaction } from "ethers";

export async function isContract(network: number, address: string): Promise<boolean> {
  const code = await getContractCode(network, address);
  return !utils.isZeroHex(code);
}

export async function getContractCode(network: number, address: string): Promise<string> {
  const provider = _getProvider(network);
  return await provider.getCode(address);
}

export async function getRawTransaction(network: number, txId: string): Promise<string | null> {
  const provider = _getProvider(network);
  const txResponse = await provider.getTransaction(txId);
  if (txResponse) {
    const tx = Transaction.from(txResponse?.toJSON());
    return tx.unsignedSerialized;
  } else {
    return null;
  }
}

function _getProvider(network: number): JsonRpcProvider {
  return new JsonRpcProvider(settings.C_CHAIN_API_RPC[network]);
}
