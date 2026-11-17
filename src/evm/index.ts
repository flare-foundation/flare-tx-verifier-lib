import * as txnetwork from "../txnetwork";
import * as txtype from "../txtype";
import * as utils from "../utils";
import * as warning from "../warning";
import { Transaction } from "ethers";
import { getContractData, getProxyTarget, isContract, isFlareContract } from "./contract";
import type { SafeTxData, TxVerification, TxVerificationParameter } from "../interface";

export async function verify(txHex: string): Promise<TxVerification | null> {
  let tx: Transaction;
  try {
    tx = Transaction.from(utils.toHex(txHex, true));

    const warnings = new Set<string>();

    const network = _getNetwork(tx, warnings);
    const recipient = _getRecipient(tx);
    const isRecipientFlrNetContract = await _isRecipientFlrNetContract(tx);
    const type = await _getType(tx, isRecipientFlrNetContract);
    const description = txtype.getDescription(type);
    const value = _getValue(tx);
    const fee = _getMaxFee(tx);
    const contract = await _getContract(tx, type, isRecipientFlrNetContract, warnings);
    const safeTxData = await _getSafeTxData(tx.chainId, contract.parameters, warnings);
    const messageToSign = tx.unsignedHash;

    return {
      network,
      type,
      description,
      recipients: [recipient],
      values: [value],
      fee,
      ...contract,
      safeTxData,
      warnings: Array.from(warnings.values()),
      messageToSign,
    };
  } catch {
    return null;
  }
}

function _getNetwork(tx: Transaction, warnings: Set<string>): string {
  const chainId = Number(tx.chainId);
  if (!txnetwork.isKnownCChainNetwork(chainId)) {
    warnings.add(warning.UNKOWN_NETWORK);
  }
  return txnetwork.getCChainNetworkDescription(chainId);
}

function _getRecipient(tx: Transaction): string {
  return tx.to ? tx.to : "";
}

async function _isRecipientFlrNetContract(tx: Transaction): Promise<boolean> {
  if (tx.to == null) {
    return false;
  }
  const chainId = Number(tx.chainId);
  if (!txnetwork.isKnownCChainNetwork(chainId)) {
    return false;
  }
  return await isFlareContract(chainId, tx.to!);
}

async function _getType(tx: Transaction, isRecipientFlrNetContract: boolean): Promise<string> {
  if (isRecipientFlrNetContract) {
    return txtype.CONTRACT_CALL_C;
  }
  if (tx.to == null) {
    return txtype.CONTRACT_CALL_C; // contract creation
  }
  const chainId = Number(tx.chainId);
  if (txnetwork.isKnownCChainNetwork(chainId)) {
    if (await isContract(chainId, tx.to)) {
      return txtype.CONTRACT_CALL_C;
    } else {
      return txtype.TRANSFER_C;
    }
  } else {
    // may be inaccurate
    if (utils.isZeroHex(tx.data)) {
      return txtype.TRANSFER_C;
    } else {
      return txtype.CONTRACT_CALL_C;
    }
  }
}

function _getValue(tx: Transaction): string {
  return tx.value.toString();
}

function _getMaxFee(tx: Transaction): string | undefined {
  let maxFee = BigInt(0);
  if (tx.gasPrice) {
    maxFee = tx.gasLimit * tx.gasPrice;
  } else if (tx.maxFeePerGas) {
    maxFee = tx.gasLimit * tx.maxFeePerGas;
  }
  if (maxFee === BigInt(0)) {
    return undefined;
  } else {
    return maxFee.toString();
  }
}

async function _getContract(
  tx: Transaction,
  type: string,
  isRecipientFlrNetContract: boolean,
  warnings: Set<string>
): Promise<any> {
  if (type !== txtype.CONTRACT_CALL_C) {
    return {};
  }

  let contractName: string | undefined;
  let contractMethod: string | undefined;
  let contractMethodABI: string | undefined;
  let contractData: string | undefined;
  let isFlareNetworkContract: boolean | undefined;
  let parameters: Array<TxVerificationParameter> | undefined;

  const chainId = Number(tx.chainId);

  contractData = tx.data;
  isFlareNetworkContract = isRecipientFlrNetContract;
  if (tx.to != null && txnetwork.isKnownCChainNetwork(chainId)) {
    let contract = await getContractData(chainId, tx.to!);

    let decodingWithProxyTarget = false;
    if (contract == null) {
      const proxyTargetAddress = await getProxyTarget(chainId, tx.to!, tx.data);
      if (proxyTargetAddress) {
        contract = await getContractData(chainId, proxyTargetAddress);
        decodingWithProxyTarget = true;
      }
    }

    if (contract) {
      contractName = contract.name;
      const txData = { data: tx.data, value: tx.value };
      let description = contract.interface.parseTransaction(txData);

      if (description == null && !decodingWithProxyTarget) {
        const proxyTargetAddress = await getProxyTarget(chainId, tx.to!, tx.data);
        if (proxyTargetAddress) {
          const proxyTarget = await getContractData(chainId, proxyTargetAddress);
          if (proxyTarget != null) {
            description = proxyTarget.interface.parseTransaction(txData);
            decodingWithProxyTarget = true;
          }
        }
      }

      if (description) {
        contractMethod = description.name;
        contractMethodABI = description.fragment.format("json");
        const inputs = description.fragment.inputs;
        parameters = [] as TxVerificationParameter[];
        for (let i = 0; i < inputs.length; i++) {
          parameters.push({
            name: inputs[i].name,
            value: description.args[i].toString(),
          });
        }
        if (decodingWithProxyTarget && !isFlareNetworkContract) {
          warnings.add(warning.PROXY_CONTRACT);
        }
      }
    }
  }

  return {
    contractName,
    contractMethod,
    contractMethodABI,
    contractData,
    isFlareNetworkContract,
    parameters,
  };
}

async function _getSafeTxData(
  chainId: bigint,
  sourceParameters: Array<TxVerificationParameter>,
  warnings: Set<string>
): Promise<SafeTxData | undefined> {
  if (!sourceParameters) {
    return undefined;
  }
  const pto = sourceParameters.find((p) => p.name === "to");
  if (!pto) {
    return undefined;
  }
  const pdata = sourceParameters.find((p) => p.name === "data");
  if (!pdata) {
    return undefined;
  }
  if (
    ["value", "operation", "safeTxGas", "baseGas", "gasPrice", "gasToken", "refundReceiver"].some(
      (p) => sourceParameters.find((x) => x.name === p) === undefined
    )
  ) {
    return undefined;
  }
  const to = pto.value;
  const data = pdata.value;
  const tx = Transaction.from({ chainId, to, data });
  const isRecipientFlrNetContract = await _isRecipientFlrNetContract(tx);
  const type = await _getType(tx, isRecipientFlrNetContract);
  const contract = await _getContract(tx, type, isRecipientFlrNetContract, warnings);

  const contractName = contract.contractName;
  const contractMethod = contract.contractMethod;
  const contractMethodABI = contract.contractMethodABI;
  const isFlareNetworkContract = contract.isFlareNetworkContract;
  const parameters = contract.parameters;
  return {
    contractName,
    contractMethod,
    contractMethodABI,
    isFlareNetworkContract,
    parameters,
  };
}
