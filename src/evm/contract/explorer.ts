import * as settings from "../../settings";
import type { AbiContractData } from "./interface";

interface ExplorerContract {
  Address?: string;
  ABI?: string;
  ContractName?: string;
}

interface Response {
  result: Array<ExplorerContract>;
  message: string;
  status: string;
}

export async function getContract(network: number, address: string): Promise<AbiContractData | null> {
  const contracts = await _get(network, `?module=contract&action=getsourcecode&address=${address}`);
  if (contracts.length > 1) {
    throw new Error("Unexpected number of contracts");
  } else if (contracts.length === 1) {
    return _parseContract(contracts[0]);
  } else {
    return null;
  }
}

export async function getContracts(network: number): Promise<Array<AbiContractData>> {
  const contracts: AbiContractData[] = [];
  const offset = 100;
  let page = 1;
  while (true) {
    const data = await _getWithRetry(
      network,
      `?module=contract&action=listcontracts&page=${page}&offset=${offset}&filter=1`
    );
    for (const item of data) {
      const contract = _parseContract(item);
      if (contract != null) {
        contracts.push(contract);
      }
    }
    if (data.length < offset) {
      break;
    }
    page++;
  }
  return contracts;
}

function _parseContract(contract: ExplorerContract): AbiContractData | null {
  if (contract?.Address && contract.ABI) {
    return {
      address: contract.Address.toLowerCase(),
      name: contract.ContractName,
      abi: contract.ABI,
    };
  } else {
    return null;
  }
}

async function _getWithRetry(network: number, path: string, attempts = 5): Promise<Array<ExplorerContract>> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await _get(network, path);
    } catch (e) {
      if (attempt >= attempts) {
        throw e;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
    }
  }
}

async function _get(network: number, path: string): Promise<Array<ExplorerContract>> {
  if (network in settings.EXPLORER) {
    const url = `${settings.EXPLORER[network]}${path}`;
    const data = await fetch(url, { signal: AbortSignal.timeout(settings.REQUEST_TIMEOUT_MS) });
    if (!data.ok) {
      throw new Error(`Explorer request failed with HTTP ${data.status}: ${url}`);
    }
    const response = (await data.json()) as Response;
    if (response.status !== "1") {
      throw new Error(response.message);
    }
    return response.result;
  } else {
    return [];
  }
}
