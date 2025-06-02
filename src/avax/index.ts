import * as txnetwork from "../txnetwork"
import * as txtype from "../txtype"
import * as settings from "../settings"
import * as utils from "../utils"
import * as warning from "../warning"
import {
    Context,
    evmSerial,
    pvmSerial,
    utils as futils,
    TypeSymbols,
    TransferOutput,
    Int,
    messageHash,
    Address,
    TransferableOutput,
    TransferableInput,
    pvm,
    networkIDs
} from "@flarenetwork/flarejs"
import { TxVerification, TxVerificationParameter } from "../interface"
import { ethers } from "ethers"

export async function verify(txHex: string): Promise<TxVerification | null> {
    txHex = utils.toHex(txHex, false)

    let ctx = _tryRecoverCTx(txHex) as evmSerial.EVMTx
    if (ctx != null) {
        return await _tryGetCTxParams(ctx)
    }

    let ptx = _tryRecoverPTx(txHex) as pvmSerial.BaseTx
    if (ptx != null) {
        return await _tryGetPTxParams(ptx)
    }

    return null
}

function _tryRecoverCTx(txHex: string): evmSerial.EVMTx | null {
    try {
        return futils.unpackWithManager("EVM", Buffer.from(txHex, "hex")) as evmSerial.EVMTx
    } catch {
        return null
    }
}

function _tryRecoverPTx(txHex: string): pvmSerial.BaseTx | null {
    try {
        return futils.unpackWithManager("PVM", Buffer.from(txHex, "hex")) as pvmSerial.BaseTx
    } catch {
        return null
    }
}

function _getMessageToSign(tx: evmSerial.EVMTx | pvmSerial.BaseTx): string {
    try {
        return utils.toHex(Buffer.from(messageHash(futils.packTx(tx))).toString("hex"), true)
    } catch {
        throw new Error("Failed to recover message to sign")
    }
}

function _getNetwork(networkId: number, warnings: Set<string>): string {
    if (!txnetwork.isKnownPChainNetwork(networkId)) {
        warnings.add(warning.UNKOWN_NETWORK)
    }
    return txnetwork.getPChainNetworkDescription(networkId)
}

async function _tryGetCTxParams(tx: evmSerial.EVMTx): Promise<TxVerification | null> {
    try {
        let warnings = new Set<string>()

        let networkId = _getNetworkIdFromEVMTx(tx)
        let context = await _getContext(networkId)

        _checkCBlockchainId(context, tx.getBlockchainId(), warnings)

        let network = _getNetwork(networkId, warnings)
        let type: string
        let params: any
        if (tx._type === TypeSymbols.EvmExportTx) {
            type = txtype.EXPORT_C
            params = _getExportCTxParams(tx as evmSerial.ExportTx, context, warnings)
        } else if (tx._type === TypeSymbols.EvmImportTx) {
            type = txtype.IMPORT_C
            params = _getImportCTxParams(tx as evmSerial.ImportTx, context, warnings)
        } else {
            throw new Error("Unkown C-chain transaction type")
        }
        let description = txtype.getDescription(type)
        let messageToSign = _getMessageToSign(tx)

        return {
            network,
            type,
            description,
            ...params,
            warnings: Array.from(warnings.values()),
            messageToSign
        }
    } catch {
        return null
    }
}

function _getNetworkIdFromEVMTx(tx: evmSerial.EVMTx): number {
    let networkIdInt = (tx as any).networkId
    if (!networkIdInt) {
        throw new Error("Failed to obtain network id from EVM transaction")
    }
    return (networkIdInt as Int).value()
}

function _getExportCTxParams(tx: evmSerial.ExportTx, context: Context.Context, warnings: Set<string>): any {
    _checkPBlockchainId(context, tx.destinationChain.toString(), warnings)

    let inputs = tx.ins
    let inputAmount = BigInt(0)
    for (let i = 0; i < inputs.length; i++) {
        inputAmount += inputs[i].amount.value()
        _checkPAssetId(context, inputs[i].assetId.toString(), warnings)
    }

    let outputs = tx.exportedOutputs
    let exportAmounts = new Array<bigint>()
    let exportRecipients = new Array<string>()
    for (let i = 0; i < outputs.length; i++) {
        let output = outputs[i].output as TransferOutput
        let addresses = output.outputOwners.addrs
        if (addresses.length > 1) {
            warnings.add(warning.MULTIPLE_SIGNERS)
        }
        let address = _addressesToString(addresses, context.hrp)
        let index = exportRecipients.indexOf(address)
        if (index < 0) {
            exportRecipients.push(address)
            exportAmounts.push(output.amount())
        } else {
            exportAmounts[index] += output.amount()
        }
        _checkOutputLockTime(output.outputOwners.locktime.value(), warnings)
        _checkPAssetId(context, outputs[i].getAssetId(), warnings)
    }
    if (exportRecipients.length > 1) {
        warnings.add(warning.MULTIPLE_RECIPIENTS)
    }

    let fee = inputAmount - _sumValues(exportAmounts)

    return {
        recipients: exportRecipients,
        values: exportAmounts.map(a => _gweiToWei(a).toString()),
        fee: _gweiToWei(fee).toString()
    }
}

function _getImportCTxParams(tx: evmSerial.ImportTx, context: Context.Context, warnings: Set<string>): any {
    _checkPBlockchainId(context, tx.sourceChain.toString(), warnings)

    let inputs = tx.importedInputs
    let inputAmount = BigInt(0)
    for (let i = 0; i < inputs.length; i++) {
        inputAmount += inputs[i].input.amount()
        _checkPAssetId(context, inputs[i].assetId.toString(), warnings)
    }

    let outputs = tx.Outs
    let importAmounts = new Array<bigint>()
    let importRecipients = new Array<string>()
    for (let i = 0; i < outputs.length; i++) {
        let output = outputs[i]
        let amount = output.amount.value()
        let address = ethers.getAddress(output.address.toHex())
        let index = importRecipients.indexOf(address)
        if (index < 0) {
            importRecipients.push(address)
            importAmounts.push(amount)
        } else {
            importAmounts[index] += amount
        }
        _checkPAssetId(context, output.assetId.toString(), warnings)
    }

    let fee = inputAmount - _sumValues(importAmounts)

    return {
        recipients: importRecipients,
        values: importAmounts.map(a => _gweiToWei(a).toString()),
        fee: _gweiToWei(fee).toString()
    }
}

async function _tryGetPTxParams(tx: pvmSerial.BaseTx): Promise<TxVerification | null> {
    try {
        let btx = tx.baseTx

        let warnings = new Set<string>()

        let networkId = btx.NetworkId.value()
        let context = await _getContext(networkId)

        _checkPBlockchainId(context, tx.getBlockchainId(), warnings)

        let network = _getNetwork(networkId, warnings)
        let type: string
        let params: any
        if (tx._type === TypeSymbols.AddPermissionlessDelegatorTx) {
            type = txtype.ADD_DELEGATOR_P
            params = await _getAddDelegatorParams(tx as pvmSerial.AddPermissionlessDelegatorTx, context, warnings)
        } else if (tx._type === TypeSymbols.AddPermissionlessValidatorTx) {
            type = txtype.ADD_VALIDATOR_P
            params = await _getAddValidatorParams(tx as pvmSerial.AddPermissionlessValidatorTx, context, warnings)
        } else if (tx._type === TypeSymbols.AddDelegatorTx) {
            type = txtype.ADD_DELEGATOR_P
            params = await _getAddDelegatorParams(tx as pvmSerial.AddDelegatorTx, context, warnings)
        } else if (tx._type === TypeSymbols.AddValidatorTx) {
            type = txtype.ADD_VALIDATOR_P
            params = await _getAddValidatorParams(tx as pvmSerial.AddValidatorTx, context, warnings)
        } else if (tx._type === TypeSymbols.PvmExportTx) {
            type = txtype.EXPORT_P
            params = await _getExportPTx(tx as pvmSerial.ExportTx, context, warnings)
        } else if (tx._type === TypeSymbols.PvmImportTx) {
            type = txtype.IMPORT_P
            params = await _getImportPTx(tx as pvmSerial.ImportTx, context, warnings)
        } else {
            throw new Error("Unkown P-chain transaction type")
        }
        let description = txtype.getDescription(type)
        let messageToSign = _getMessageToSign(tx)
        return {
            network,
            type,
            description,
            ...params,
            warnings: Array.from(warnings.values()),
            messageToSign
        }
    } catch {
        return null
    }
}

async function _getAddDelegatorParams(
    tx: pvmSerial.AddPermissionlessDelegatorTx | pvmSerial.AddDelegatorTx,
    context: Context.Context,
    warnings: Set<string>
): Promise<any> {
    return _getStakeTxData(tx, context, warnings)
}

async function _getAddValidatorParams(
    tx: pvmSerial.AddPermissionlessValidatorTx | pvmSerial.AddValidatorTx,
    context: Context.Context,
    warnings: Set<string>
): Promise<any> {
    return _getStakeTxData(tx, context, warnings)
}

async function _getStakeTxData(
    tx: pvmSerial.AddPermissionlessDelegatorTx | pvmSerial.AddPermissionlessValidatorTx | pvmSerial.AddDelegatorTx | pvmSerial.AddValidatorTx,
    context: Context.Context,
    warnings: Set<string>
): Promise<any> {
    if (tx instanceof pvmSerial.AddDelegatorTx || tx instanceof pvmSerial.AddValidatorTx) {
        warnings.add(warning.DEPRECATED_TX)
    }

    let [recipients, receivedAmounts] = _getPOutputsData(
        context,
        tx.baseTx.outputs,
        warnings
    )
    
    let sentAmount = await _getPInputsData(
        context,
        tx.baseTx.inputs,
        recipients.length == 1 && !recipients[0].includes(",") ? recipients[0] : undefined,
        undefined,
        warnings
    )

    let stakeAmount = tx.stake.reduce((p, c) => { return p += c.amount() }, BigInt(0))
    let fee = sentAmount - _sumValues(receivedAmounts) - stakeAmount

    let [stakeoutRecipients, stakeoutAmounts] = _getPOutputsData(
        context,
        tx.stake,
        warnings
    )
    _compareRecipients(stakeoutRecipients, recipients, warnings)

    if (tx instanceof pvmSerial.AddPermissionlessDelegatorTx || tx instanceof pvmSerial.AddDelegatorTx) {
        await _checkNodeId(tx, context, warnings)
    }

    let validator: pvmSerial.Validator
    if (tx instanceof pvmSerial.AddPermissionlessDelegatorTx || tx instanceof pvmSerial.AddPermissionlessValidatorTx) {
        _checkSubnetId(tx, warnings)
        validator = tx.subnetValidator.validator
    } else {
        validator = tx.validator
    }

    let parameters = new Array<TxVerificationParameter>()
    parameters.push({
        name: "nodeId",
        value: validator.nodeId.toString()
    })
    parameters.push({
        name: "startTime",
        value: validator.startTime.value().toString()
    })
    parameters.push({
        name: "endTime",
        value: validator.endTime.value().toString()
    })
    if (tx instanceof pvmSerial.AddPermissionlessValidatorTx) {
        parameters.push({
            name: "delegationFee",
            value: (tx.shares.value() * 1e4).toString()
        })
    }
    if (tx instanceof pvmSerial.AddValidatorTx) {
        parameters.push({
            name: "delegationFee",
            value: tx.shares.value().toString()
        })
    }

    return {
        recipients: stakeoutRecipients,
        values: stakeoutAmounts.map(a => _gweiToWei(a).toString()),
        fee: _gweiToWei(fee).toString(),
        parameters
    }
}

async function _getExportPTx(
    tx: pvmSerial.ExportTx,
    context: Context.Context,
    warnings: Set<string>
): Promise<any> {
    _checkCBlockchainId(context, tx.destination.toString(), warnings)
    let [utxoRecipients, utxoReceivedAmounts] = _getPOutputsData(
        context,
        tx.baseTx.outputs,
        warnings
    )
    let [exportRecipients, exportAmounts] = _getPOutputsData(
        context,
        tx.outs,
        warnings
    )
    _compareRecipients(exportRecipients, utxoRecipients, warnings)

    let utxoSentAmount = await _getPInputsData(
        context,
        tx.baseTx.inputs,
        exportRecipients.length == 1 && !exportRecipients.includes(",") ? exportRecipients[0] : undefined,
        undefined,
        warnings
    )

    let fee = utxoSentAmount - _sumValues(utxoReceivedAmounts) - _sumValues(exportAmounts)

    return {
        recipients: exportRecipients,
        values: exportAmounts.map(a => _gweiToWei(a).toString()),
        fee: _gweiToWei(fee).toString()
    }
}

async function _getImportPTx(
    tx: pvmSerial.ImportTx,
    context: Context.Context,
    warnings: Set<string>
): Promise<any> {
    _checkCBlockchainId(context, tx.sourceChain.toString(), warnings)

    let [recipients, receivedAmounts] = _getPOutputsData(
        context,
        tx.baseTx.outputs,
        warnings
    )

    let sentAmount = await _getPInputsData(
        context,
        tx.baseTx.inputs,
        recipients.length == 1 && !recipients[0].includes(",") ? recipients[0] : undefined,
        context.cBlockchainID.toString(),
        warnings
    )

    let importAmount = await _getPInputsData(
        context,
        tx.ins,
        recipients.length == 1 && !recipients[0].includes(",") ? recipients[0] : undefined,
        context.cBlockchainID.toString(),
        warnings
    )

    let fee = importAmount + sentAmount - _sumValues(receivedAmounts)

    return {
        recipients,
        values: receivedAmounts.map(a => _gweiToWei(a).toString()),
        fee: _gweiToWei(fee).toString()
    }
}

async function _getPInputsData(
    context: Context.Context,
    inputs: Array<TransferableInput>,
    address: string | undefined,
    blockchainId: string | undefined,
    warnings: Set<string>
): Promise<bigint> {
    let utxos = address ? (await _getPUTXOs(context, address, blockchainId)) : new Array<any>()
    let sentAmount = BigInt(0)
    for (let input of inputs) {
        let ai = input.input
        sentAmount += ai.amount()
        _checkPAssetId(context, input.assetId.toString(), warnings)
        if (address) {
            let txId = input.utxoID.txID.toString()
            let outputIdx = input.utxoID.outputIdx.value()
            if (!utxos.find(u => u.txId === txId && u.outputIdx === outputIdx)) {
                warnings.add(warning.FUNDS_NOT_RETURNED)
            }
        }
    }
    return sentAmount
}

function _getPOutputsData(
    context: Context.Context,
    outputs: Array<TransferableOutput>,
    warnings: Set<string>
): [Array<string>, Array<bigint>] {
    let recipients = new Array<string>()
    let receivedAmounts = new Array<bigint>()
    for (let output of outputs) {
        let ao = output.output as TransferOutput
        let addresses = ao.outputOwners.addrs
        if (addresses.length != 1) {
            warnings.add(warning.MULTIPLE_SIGNERS)
        }
        let address = _addressesToString(addresses, context.hrp)
        let index = recipients.indexOf(address)
        if (index < 0) {
            recipients.push(address)
            receivedAmounts.push(ao.amount())
        } else {
            receivedAmounts[index] += ao.amount()
        }
        _checkOutputLockTime(ao.getLocktime(), warnings)
        _checkPAssetId(context, output.assetId.toString(), warnings)
    }
    if (recipients.length > 1) {
        warnings.add(warning.MULTIPLE_RECIPIENTS)
    }
    return [recipients, receivedAmounts]
}

async function _getPUTXOs(
    context: Context.Context,
    address: string,
    blockchainId?: string
): Promise<Array<any>> {
    let pvmApi = _getPVMApi(context.networkID)
    if (pvmApi == null) {
        return new Array<any>()
    }

    let response = await pvmApi.getUTXOs({ addresses: [`P-${address}`], sourceChain: blockchainId })
    return response.utxos.map(u => {
        return {
            txId: u.utxoId.txID.toString(),
            outputIdx: u.utxoId.outputIdx.value()
        }
    })
}

async function _checkNodeId(
    tx: pvmSerial.AddPermissionlessDelegatorTx | pvmSerial.AddDelegatorTx,
    context: Context.Context,
    warnings: Set<string>
): Promise<void> {
    let pvmApi = _getPVMApi(context.networkID)
    if (pvmApi == null) {
        warnings.add(warning.UNKNOWN_NODEID)
        return
    }

    let txNodeId: string
    if (tx instanceof pvmSerial.AddPermissionlessDelegatorTx) {
        txNodeId = tx.subnetValidator.validator.nodeId.toString()
    } else {
        txNodeId = tx.validator.nodeId.toString()
    }

    let cresponse = await pvmApi.getCurrentValidators()
    for (let validator of cresponse.validators) {
        if (validator.nodeID === txNodeId) {
            return
        }
    }
    let presponse = await pvmApi.getPendingValidators()
    for (let validator of presponse.validators) {
        if (validator.nodeID === txNodeId) {
            return
        }
    }
    warnings.add(warning.UNKNOWN_NODEID)
}

function _checkSubnetId(
    tx: pvmSerial.AddPermissionlessDelegatorTx | pvmSerial.AddPermissionlessValidatorTx,
    warnings: Set<string>
): void {
    if (tx.subnetValidator.subnetId.toString() !== networkIDs.PrimaryNetworkID.toString()) {
        warnings.add(warning.UNKOWN_SUBNET)
    }
}

function _getPVMApi(networkId: number): pvm.PVMApi {
    if (!(networkId in settings.P_CHAIN_API)) {
        return null
    }
    let uri = new URL(settings.P_CHAIN_API[networkId]).origin
    return new pvm.PVMApi(uri)
}

async function _getContext(networkId: number): Promise<Context.Context> {
    if (!(networkId in settings.P_CHAIN_API)) {
        return null
    }
    let uri = new URL(settings.P_CHAIN_API[networkId]).origin
    let context = await Context.getContextFromURI(uri)
    if (context.networkID !== networkId) {
        throw new Error(`The API network ${context.networkID} does not match the expected network ${networkId}`)
    }
    return context
}

function _addressesToString(
    addresses: Array<Address>,
    hrp: string
): string {
    let items = new Array(addresses.length)
    for (let i = 0; i < addresses.length; i++) {
        items[i] = addresses[i].toString(hrp)
    }
    return items.sort().join(", ")
}

function _checkOutputLockTime(outputLockTime: bigint, warnings: Set<string>) {
    if (outputLockTime !== BigInt(0)) {
        warnings.add(warning.FUNDS_LOCKED)
    }
}

function _checkCBlockchainId(context: Context.Context, blockchainId: string, warnings: Set<string>) {
    if (blockchainId !== context.cBlockchainID) {
        warnings.add(warning.INVALID_BLOCKCHAIN)
    }
}

function _checkPBlockchainId(context: Context.Context, blockchainId: string, warnings: Set<string>) {
    if (blockchainId !== context.pBlockchainID) {
        warnings.add(warning.INVALID_BLOCKCHAIN)
    }
}

function _checkPAssetId(context: Context.Context, assetId: string, warnings: Set<string>) {
    if (assetId !== context.avaxAssetID) {
        warnings.add(warning.INVALID_ASSET)
    }
}

function _compareRecipients(
    recipients: Array<string>,
    utxoRecipients: Array<string>,
    warnings: Set<string>
) {
    if (recipients.length != 1) {
        return
    }
    if (utxoRecipients.length == 0) {
        return
    }
    if (utxoRecipients.length > 1 || utxoRecipients[0] !== recipients[0]) {
        warnings.add(warning.UNSPENT_AMOUNT_NOT_TO_RECIPIENT)
    }
}

function _sumValues(values: Array<bigint>): bigint {
    return values.reduce((p, c) => p + c, BigInt(0))
}

function _gweiToWei(gweiValue: bigint): bigint {
    return gweiValue * BigInt(1e9)
}