import { registry } from "./registry";
import * as settings from "../../settings";
import * as utils from "../../utils";
import { Contract, JsonRpcProvider, Transaction } from "ethers";
import type { BaseContractData } from "./interface";

/**
 * @deprecated
 */
export async function getFlareNetworkContracts(network: number): Promise<Array<BaseContractData>> {
  const provider = _getProvider(network);
  const address = settings.FLARE_CONTRACT_REGISTRY[network];
  const contractData = registry[network][address];
  const contractRegistry = new Contract(address, contractData.abi, provider);
  const contracts = await contractRegistry.getAllContracts();
  const result: BaseContractData[] = [];
  for (let i = 0; i < contracts[0].length; i++) {
    result.push({
      address: contracts[1][i].toLowerCase(),
      name: contracts[0][i],
    });
  }
  return result;
}

/**
 * @deprecated
 */
export async function isFlareNetworkContract(network: number, address: string): Promise<boolean> {
  const contracts = await getFlareNetworkContracts(network);
  return contracts.find((c) => c.address === address) !== undefined;
}

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
