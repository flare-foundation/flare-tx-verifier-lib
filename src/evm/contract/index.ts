import * as chain from "./chain";
import * as explorer from "./explorer";
import type { ContractData, AbiContractData, ContractRegistry } from "./interface";
import * as proxy from "./proxy";
import * as repository from "./repository";
import registryJson from "./registry.json";
import { Interface } from "ethers";
import * as utils from "../../utils";

const registry: ContractRegistry = registryJson;

export async function getContractData(network: number, address: string): Promise<ContractData | null> {
  let data = _getDataFromRegistry(network, address.toLowerCase());
  if (data == null) {
    data = await _getDataFromExplorer(network, address.toLowerCase());
  }
  return _toContractData(data);
}

export async function isFlareContract(network: number, address: string): Promise<boolean> {
  if (_containsAddress(await repository.getAddressesOfFlareSmartContractsV2(network), address)) {
    return true;
  }
  if (_containsAddress(await repository.getAddressesOfFlareFassetContracts(network), address)) {
    return true;
  }
  if (_containsAddress(await repository.getAddressesOfFlareSmartContractsV1(network), address)) {
    return true;
  }
  return false;
}

export async function isContract(network: number, address: string): Promise<boolean> {
  return chain.isContract(network, address.toLowerCase());
}

export async function getContractCode(network: number, address: string): Promise<string> {
  return chain.getContractCode(network, address.toLowerCase());
}

export async function getProxyTarget(network: number, address: string, data: string): Promise<string | null> {
  return proxy.target(network, address, data);
}

function _getDataFromRegistry(network: number, address: string): AbiContractData | null {
  const contracts = registry.contracts[network.toString()];
  if (contracts == null || !(address in contracts)) {
    return null;
  }
  const entry = contracts[address];
  return {
    address,
    name: entry.name,
    abi: registry.abis[entry.abi],
  };
}

async function _getDataFromExplorer(network: number, address: string): Promise<AbiContractData | null> {
  return explorer.getContract(network, address);
}

function _toContractData(data: AbiContractData | null): ContractData | null {
  if (data == null) {
    return null;
  } else {
    return {
      ...data,
      interface: Interface.from(data.abi),
    };
  }
}

function _containsAddress(addresses: Array<string>, address: string) {
  const ca = utils.toHex(address, false);
  return addresses.find((a) => utils.toHex(a, false) === ca) !== undefined;
}
