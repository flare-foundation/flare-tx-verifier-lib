import type { Interface, InterfaceAbi } from "ethers";

export type NetworkRegistry = {
  [key: number]: ContractRegistry;
};

export type ContractRegistry = {
  [key: string]: AbiContractData;
};

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
