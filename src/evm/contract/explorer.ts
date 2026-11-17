import * as settings from "../../settings";
import type { AbiContractData } from "./interface";

interface Response {
  result: any;
  message: string;
  status: string;
}

export async function getContract(network: number, address: string): Promise<AbiContractData | null> {
  const contracts = (await _get(network, `?module=contract&action=getsourcecode&address=${address}`)) as Array<any>;
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
  const offset = 1000;
  let page = 1;
  while (true) {
    const data = (await _get(
      network,
      `?module=contract&action=listcontracts&page=${page}&offset=${offset}&filter=1`
    )) as Array<any>;
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

function _parseContract(contract: any): AbiContractData | null {
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

async function _get(network: number, path: string): Promise<any> {
  if (network in settings.EXPLORER) {
    const url = `${settings.EXPLORER[network]}${path}`;
    const data = await fetch(url);
    const response = (await data.json()) as Response;
    if (response.status !== "1") {
      throw new Error(response.message);
    }
    return response.result;
  } else {
    return [];
  }
}
