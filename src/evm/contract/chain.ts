import * as settings from "../../settings";
import * as utils from "../../utils";
import { FetchRequest, JsonRpcProvider, Network, Transaction } from "ethers";

const providers = new Map<number, JsonRpcProvider>();

/**
 * Returns a shared provider for the network. The network is set in advance, so the provider does not
 * query it, which would otherwise be retried in the background indefinitely if the node is unreachable.
 */
export function getProvider(network: number): JsonRpcProvider {
  let provider = providers.get(network);
  if (provider == null) {
    const request = new FetchRequest(settings.C_CHAIN_API_RPC[network]);
    request.timeout = settings.REQUEST_TIMEOUT_MS;
    const staticNetwork = Network.from(network);
    provider = new JsonRpcProvider(request, staticNetwork, { staticNetwork });
    providers.set(network, provider);
  }
  return provider;
}

export async function isContract(network: number, address: string): Promise<boolean> {
  const code = await getContractCode(network, address);
  return !utils.isZeroHex(code);
}

export async function getContractCode(network: number, address: string): Promise<string> {
  return await getProvider(network).getCode(address);
}

export async function getRawTransaction(network: number, txId: string): Promise<string | null> {
  const txResponse = await getProvider(network).getTransaction(txId);
  if (txResponse) {
    const tx = Transaction.from(txResponse?.toJSON());
    return tx.unsignedSerialized;
  } else {
    return null;
  }
}
