import type { Interface, InterfaceAbi } from "ethers";

/**
 * Bundled contract registry (registry.json). Each distinct ABI is stored once under
 * a content hash; contracts reference their ABI by that hash.
 */
export interface ContractRegistry {
  abis: { [hash: string]: InterfaceAbi };
  contracts: { [network: string]: { [address: string]: RegistryEntry } };
}

export interface RegistryEntry {
  name: string;
  abi: string;
}

export interface BaseContractData {
  address: string;
  name: string;
}

export interface AbiContractData extends BaseContractData {
  abi: InterfaceAbi;
}

export interface ContractData extends AbiContractData {
  interface: Interface;
}
