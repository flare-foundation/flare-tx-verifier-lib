import * as txnetwork from "../txnetwork"
import * as txtype from "../txtype"
import * as utils from "../utils"
import * as warning from "../warning"
import { Transaction } from "ethers";
import { getContractData, isContract, isFlareContract } from "./contract";
import { TxVerification, TxVerificationParameter } from "../interface";

export async function verify(txHex: string): Promise<TxVerification | null> {
    let tx: Transaction
    try {
        tx = Transaction.from(utils.toHex(txHex, true))

        let warnings = new Set<string>()

        let network = _getNetwork(tx, warnings)
        let recipient = _getRecipient(tx)
        let isRecipientFlrNetContract = await _isRecipientFlrNetContract(tx)
        let type = await _getType(tx, isRecipientFlrNetContract)
        let description = txtype.getDescription(type)
        let value = _getValue(tx)
        let fee = _getMaxFee(tx)
        let contract = await _getContract(tx, type, isRecipientFlrNetContract)
        let messageToSign = tx.unsignedHash

        return {
            network,
            type,
            description,
            recipients: [recipient],
            values: [value],
            fee,
            ...contract,
            warnings: Array.from(warnings.values()),
            messageToSign
        }
    } catch {
        return null
    }
}

function _getNetwork(tx: Transaction, warnings: Set<string>): string {
    let chainId = Number(tx.chainId)
    if (!txnetwork.isKnownNetwork(chainId)) {
        warnings.add(warning.UNKOWN_NETWORK)
    }
    return txnetwork.getDescription(chainId)
}

function _getRecipient(tx: Transaction): string {
    return tx.to ? tx.to : ""
}

async function _isRecipientFlrNetContract(tx: Transaction): Promise<boolean> {
    if (tx.to == null) {
        return false
    }
    let chainId = Number(tx.chainId)
    if (!txnetwork.isKnownNetwork(chainId)) {
        return false
    }
    return await isFlareContract(chainId, tx.to!)
}

async function _getType(tx: Transaction, isRecipientFlrNetContract: boolean): Promise<string> {
    if (isRecipientFlrNetContract) {
        return txtype.CONTRACT_CALL_C
    }
    if (tx.to == null) {
        return txtype.CONTRACT_CALL_C // contract creation
    }
    let chainId = Number(tx.chainId)
    if (txnetwork.isKnownNetwork(chainId)) {
        if (await isContract(chainId, tx.to)) {
            return txtype.CONTRACT_CALL_C
        } else {
            return txtype.TRANSFER_C
        }
    } else {
        // may be inaccurate
        if (utils.isZeroHex(tx.data)) {
            return txtype.TRANSFER_C
        } else {
            return txtype.CONTRACT_CALL_C
        }
    }
}

function _getValue(tx: Transaction): string {
    return tx.value.toString()
}

function _getMaxFee(tx: Transaction): string | undefined {
    let maxFee = BigInt(0)
    if (tx.gasPrice) {
        maxFee = tx.gasLimit * tx.gasPrice
    } else if (tx.maxFeePerGas) {
        maxFee = tx.gasLimit * tx.maxFeePerGas
    }
    if (maxFee === BigInt(0)) {
        return undefined
    } else {
        return maxFee.toString()
    }
}

async function _getContract(
    tx: Transaction,
    type: string,
    isRecipientFlrNetContract: boolean
): Promise<any> {
    if (type !== txtype.CONTRACT_CALL_C) {
        return {}
    }

    let contractName: string | undefined = undefined
    let contractMethod: string | undefined = undefined
    let contractMethodABI: string | undefined = undefined
    let contractData: string | undefined = undefined
    let isFlareNetworkContract: boolean | undefined = undefined
    let parameters: Array<TxVerificationParameter> | undefined = undefined

    let chainId = Number(tx.chainId)

    contractData = tx.data
    isFlareNetworkContract = isRecipientFlrNetContract
    if (tx.to != null && txnetwork.isKnownNetwork(chainId)) {
        let contract = await getContractData(chainId, tx.to!)
        if (contract) {
            contractName = contract.name
            let txData = { data: tx.data, value: tx.value }
            let description = contract.interface.parseTransaction(txData)
            if (description) {
                contractMethod = description.name
                contractMethodABI = description.fragment.format("json");
                let inputs = description.fragment.inputs
                parameters = Array<TxVerificationParameter>()
                for (let i = 0; i < inputs.length; i++) {
                    parameters.push({
                        name: inputs[i].name,
                        value: description.args[i].toString()
                    })
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
        parameters
    }
}