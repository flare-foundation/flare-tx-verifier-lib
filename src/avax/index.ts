import * as txnetwork from "../txnetwork";
import * as txtype from "../txtype";
import * as settings from "../settings";
import * as utils from "../utils";
import * as warning from "../warning";
import {
  Context,
  type evmSerial,
  pvmSerial,
  utils as futils,
  TypeSymbols,
  type TransferOutput,
  messageHash,
  type Address,
  type TransferableOutput,
  type TransferableInput,
  pvm,
  networkIDs,
} from "@flarenetwork/flarejs";
import type { TxVerification, TxVerificationParameter } from "../interface";
import { ethers } from "ethers";

type TxParams = Pick<TxVerification, "recipients" | "values" | "fee" | "parameters">;

// The node returns at most 1024 UTXOs per request; further pages are fetched up to the cap.
const UTXO_PAGE_SIZE = 1024;
const MAX_UTXO_PAGES = 20;

export async function verify(txHex: string): Promise<TxVerification | null> {
  txHex = utils.toHex(txHex, false);

  const ctx = _tryRecoverCTx(txHex) as evmSerial.EVMTx;
  if (ctx != null) {
    return await _tryGetCTxParams(ctx);
  }

  const ptx = _tryRecoverPTx(txHex) as pvmSerial.BaseTx;
  if (ptx != null) {
    return await _tryGetPTxParams(ptx);
  }

  return null;
}

function _tryRecoverCTx(txHex: string): evmSerial.EVMTx | null {
  try {
    return futils.unpackWithManager("EVM", Buffer.from(txHex, "hex")) as evmSerial.EVMTx;
  } catch {
    return null;
  }
}

function _tryRecoverPTx(txHex: string): pvmSerial.BaseTx | null {
  try {
    return futils.unpackWithManager("PVM", Buffer.from(txHex, "hex")) as pvmSerial.BaseTx;
  } catch {
    return null;
  }
}

function _getMessageToSign(tx: evmSerial.EVMTx | pvmSerial.BaseTx): string {
  try {
    return utils.toHex(Buffer.from(messageHash(futils.packTx(tx))).toString("hex"), true);
  } catch {
    throw new Error("Failed to recover message to sign");
  }
}

function _getNetwork(networkId: number, warnings: Set<string>): string {
  if (!txnetwork.isKnownPChainNetwork(networkId)) {
    warnings.add(warning.UNKNOWN_NETWORK);
  }
  return txnetwork.getPChainNetworkDescription(networkId);
}

async function _tryGetCTxParams(tx: evmSerial.EVMTx): Promise<TxVerification | null> {
  try {
    const warnings = new Set<string>();

    const networkId = _getNetworkIdFromEVMTx(tx);
    const context = await _getContext(networkId);

    _checkCBlockchainId(context, tx.getBlockchainId(), warnings);

    const network = _getNetwork(networkId, warnings);
    let type: string;
    let params: TxParams;
    if (tx._type === TypeSymbols.EvmExportTx) {
      type = txtype.EXPORT_C;
      params = _getExportCTxParams(tx as evmSerial.ExportTx, context, warnings);
    } else if (tx._type === TypeSymbols.EvmImportTx) {
      type = txtype.IMPORT_C;
      params = _getImportCTxParams(tx as evmSerial.ImportTx, context, warnings);
    } else {
      throw new Error("Unknown C-chain transaction type");
    }
    const description = txtype.getDescription(type);
    const messageToSign = _getMessageToSign(tx);

    return {
      network,
      type,
      description,
      ...params,
      warnings: Array.from(warnings.values()),
      messageToSign,
    };
  } catch {
    return null;
  }
}

function _getNetworkIdFromEVMTx(tx: evmSerial.EVMTx): number {
  const networkIdInt = (tx as evmSerial.ExportTx | evmSerial.ImportTx).networkId;
  if (!networkIdInt) {
    throw new Error("Failed to obtain network id from EVM transaction");
  }
  return networkIdInt.value();
}

function _getExportCTxParams(tx: evmSerial.ExportTx, context: Context.Context, warnings: Set<string>): TxParams {
  _checkPBlockchainId(context, tx.destinationChain.toString(), warnings);

  const inputs = tx.ins;
  let inputAmount = BigInt(0);
  for (let i = 0; i < inputs.length; i++) {
    inputAmount += inputs[i].amount.value();
    _checkPAssetId(context, inputs[i].assetId.toString(), warnings);
  }

  const outputs = tx.exportedOutputs;
  const exportAmounts: bigint[] = [];
  const exportRecipients: string[] = [];
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i].output as TransferOutput;
    const addresses = output.outputOwners.addrs;
    _checkOutputOwners(output.outputOwners, warnings);
    const address = _addressesToString(addresses, context.hrp);
    const index = exportRecipients.indexOf(address);
    if (index < 0) {
      exportRecipients.push(address);
      exportAmounts.push(output.amount());
    } else {
      exportAmounts[index] += output.amount();
    }
    _checkOutputLockTime(output.outputOwners.locktime.value(), warnings);
    _checkPAssetId(context, outputs[i].getAssetId(), warnings);
  }
  if (exportRecipients.length > 1) {
    warnings.add(warning.MULTIPLE_RECIPIENTS);
  }

  const fee = inputAmount - _sumValues(exportAmounts);

  return {
    recipients: exportRecipients,
    values: exportAmounts.map((a) => _gweiToWei(a).toString()),
    fee: _gweiToWei(fee).toString(),
  };
}

function _getImportCTxParams(tx: evmSerial.ImportTx, context: Context.Context, warnings: Set<string>): TxParams {
  _checkPBlockchainId(context, tx.sourceChain.toString(), warnings);

  const inputs = tx.importedInputs;
  let inputAmount = BigInt(0);
  for (let i = 0; i < inputs.length; i++) {
    inputAmount += inputs[i].input.amount();
    _checkPAssetId(context, inputs[i].assetId.toString(), warnings);
  }

  const outputs = tx.Outs;
  const importAmounts: bigint[] = [];
  const importRecipients: string[] = [];
  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i];
    const amount = output.amount.value();
    const address = ethers.getAddress(output.address.toHex());
    const index = importRecipients.indexOf(address);
    if (index < 0) {
      importRecipients.push(address);
      importAmounts.push(amount);
    } else {
      importAmounts[index] += amount;
    }
    _checkPAssetId(context, output.assetId.toString(), warnings);
  }

  const fee = inputAmount - _sumValues(importAmounts);

  return {
    recipients: importRecipients,
    values: importAmounts.map((a) => _gweiToWei(a).toString()),
    fee: _gweiToWei(fee).toString(),
  };
}

async function _tryGetPTxParams(tx: pvmSerial.BaseTx): Promise<TxVerification | null> {
  try {
    const btx = tx.baseTx;

    const warnings = new Set<string>();

    const networkId = btx.NetworkId.value();
    const context = await _getContext(networkId);

    _checkPBlockchainId(context, tx.getBlockchainId(), warnings);

    const network = _getNetwork(networkId, warnings);
    let type: string;
    let params: TxParams;
    if (tx._type === TypeSymbols.AddPermissionlessDelegatorTx) {
      type = txtype.ADD_DELEGATOR_P;
      params = await _getAddDelegatorParams(tx as pvmSerial.AddPermissionlessDelegatorTx, context, warnings);
    } else if (tx._type === TypeSymbols.AddPermissionlessValidatorTx) {
      type = txtype.ADD_VALIDATOR_P;
      params = await _getAddValidatorParams(tx as pvmSerial.AddPermissionlessValidatorTx, context, warnings);
    } else if (tx._type === TypeSymbols.AddDelegatorTx) {
      type = txtype.ADD_DELEGATOR_P;
      params = await _getAddDelegatorParams(tx as pvmSerial.AddDelegatorTx, context, warnings);
    } else if (tx._type === TypeSymbols.AddValidatorTx) {
      type = txtype.ADD_VALIDATOR_P;
      params = await _getAddValidatorParams(tx as pvmSerial.AddValidatorTx, context, warnings);
    } else if (tx._type === TypeSymbols.AddAutoRenewedValidatorTx) {
      type = txtype.ADD_AUTO_RENEWED_VALIDATOR_P;
      params = await _getAddAutoRenewedValidatorParams(tx as pvmSerial.AddAutoRenewedValidatorTx, context, warnings);
    } else if (tx._type === TypeSymbols.SetAutoRenewedValidatorConfigTx) {
      const stx = tx as pvmSerial.SetAutoRenewedValidatorConfigTx;
      // A zero period ends the validation after the current validation period.
      type =
        stx.period.value() === BigInt(0)
          ? txtype.REMOVE_AUTO_RENEWED_VALIDATOR_P
          : txtype.UPDATE_AUTO_RENEWED_VALIDATOR_P;
      params = await _getSetAutoRenewedValidatorParams(stx, context, warnings);
    } else if (tx._type === TypeSymbols.PvmExportTx) {
      type = txtype.EXPORT_P;
      params = await _getExportPTx(tx as pvmSerial.ExportTx, context, warnings);
    } else if (tx._type === TypeSymbols.PvmImportTx) {
      type = txtype.IMPORT_P;
      params = await _getImportPTx(tx as pvmSerial.ImportTx, context, warnings);
    } else if (tx._type === TypeSymbols.PvmBaseTx) {
      type = txtype.TRANSFER_P;
      params = await _getTransferPTx(tx as pvmSerial.BaseTx, context, warnings);
    } else {
      throw new Error("Unknown P-chain transaction type");
    }
    const description = txtype.getDescription(type);
    const messageToSign = _getMessageToSign(tx);
    return {
      network,
      type,
      description,
      ...params,
      warnings: Array.from(warnings.values()),
      messageToSign,
    };
  } catch {
    return null;
  }
}

async function _getAddDelegatorParams(
  tx: pvmSerial.AddPermissionlessDelegatorTx | pvmSerial.AddDelegatorTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  return _getStakeTxData(tx, context, warnings);
}

async function _getAddValidatorParams(
  tx: pvmSerial.AddPermissionlessValidatorTx | pvmSerial.AddValidatorTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  return _getStakeTxData(tx, context, warnings);
}

async function _getStakeTxData(
  tx:
    | pvmSerial.AddPermissionlessDelegatorTx
    | pvmSerial.AddPermissionlessValidatorTx
    | pvmSerial.AddDelegatorTx
    | pvmSerial.AddValidatorTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  if (tx instanceof pvmSerial.AddDelegatorTx || tx instanceof pvmSerial.AddValidatorTx) {
    warnings.add(warning.DEPRECATED_TX);
  }

  const [recipients, receivedAmounts] = _getPOutputsData(context, tx.baseTx.outputs, warnings);

  const sentAmount = await _getPInputsData(
    context,
    tx.baseTx.inputs,
    recipients.length === 1 && _isSingleAddress(recipients[0]) ? [recipients[0]] : undefined,
    undefined,
    warnings
  );

  let stakeAmount = BigInt(0);
  for (const output of tx.stake) {
    stakeAmount += output.amount();
  }

  const fee = sentAmount - _sumValues(receivedAmounts) - stakeAmount;

  const [stakeoutRecipients, stakeoutAmounts] = _getPOutputsData(context, tx.stake, warnings);
  _compareRecipients(stakeoutRecipients, recipients, warnings);
  await _checkFirstInputOwner(context, tx.baseTx.inputs, stakeoutRecipients, warnings);

  let validator: pvmSerial.Validator;
  if (tx instanceof pvmSerial.AddPermissionlessDelegatorTx || tx instanceof pvmSerial.AddPermissionlessValidatorTx) {
    _checkSubnetId(tx, warnings);
    validator = tx.subnetValidator.validator;
  } else {
    validator = tx.validator;
  }

  const parameters: TxVerificationParameter[] = [];
  parameters.push({
    name: "nodeId",
    value: validator.nodeId.toString(),
  });
  parameters.push({
    name: "startTime",
    value: validator.startTime.value().toString(),
  });
  parameters.push({
    name: "endTime",
    value: validator.endTime.value().toString(),
  });
  if (tx instanceof pvmSerial.AddPermissionlessValidatorTx || tx instanceof pvmSerial.AddValidatorTx) {
    parameters.push({
      name: "delegationFee",
      value: (tx.shares.value() / 1e4).toString(),
    });
  }

  return {
    recipients: stakeoutRecipients,
    values: stakeoutAmounts.map((a) => _gweiToWei(a).toString()),
    fee: _gweiToWei(fee).toString(),
    parameters,
  };
}

async function _getAddAutoRenewedValidatorParams(
  tx: pvmSerial.AddAutoRenewedValidatorTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  const [recipients, receivedAmounts] = _getPOutputsData(context, tx.baseTx.outputs, warnings);

  const sentAmount = await _getPInputsData(
    context,
    tx.baseTx.inputs,
    recipients.length === 1 && _isSingleAddress(recipients[0]) ? [recipients[0]] : undefined,
    undefined,
    warnings
  );

  let stakeAmount = BigInt(0);
  for (const output of tx.stake) {
    stakeAmount += output.amount();
  }

  const fee = sentAmount - _sumValues(receivedAmounts) - stakeAmount;

  const [stakeoutRecipients, stakeoutAmounts] = _getPOutputsData(context, tx.stake, warnings);
  _compareRecipients(stakeoutRecipients, recipients, warnings);
  await _checkFirstInputOwner(context, tx.baseTx.inputs, stakeoutRecipients, warnings);

  // Rewards owners and auto-compounding are not reported: Flare pays no staking rewards
  // on the P-chain (staking rewards are claimed on the C-chain).
  // An authority with no or multiple addresses is reported by VALIDATOR_AUTHORITY_NOT_TO_STAKE_OWNER.
  const authority = tx.getValidatorAuthority();
  const validatorAuthority = _addressesToString(authority.addrs, context.hrp);
  if (stakeoutRecipients.length !== 1 || validatorAuthority !== stakeoutRecipients[0]) {
    warnings.add(warning.VALIDATOR_AUTHORITY_NOT_TO_STAKE_OWNER);
  }

  const parameters: TxVerificationParameter[] = [];
  parameters.push({
    name: "nodeId",
    value: tx.nodeId.toString(),
  });
  parameters.push({
    name: "period",
    value: tx.period.value().toString(),
  });
  parameters.push({
    name: "delegationFee",
    value: (tx.delegationShares.value() / 1e4).toString(),
  });
  parameters.push({
    name: "validatorAuthority",
    value: validatorAuthority,
  });

  return {
    recipients: stakeoutRecipients,
    values: stakeoutAmounts.map((a) => _gweiToWei(a).toString()),
    fee: _gweiToWei(fee).toString(),
    parameters,
  };
}

async function _getSetAutoRenewedValidatorParams(
  tx: pvmSerial.SetAutoRenewedValidatorConfigTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  const [recipients, receivedAmounts] = _getPOutputsData(context, tx.baseTx.outputs, warnings);

  const sentAmount = await _getPInputsData(
    context,
    tx.baseTx.inputs,
    recipients.length === 1 && _isSingleAddress(recipients[0]) ? [recipients[0]] : undefined,
    undefined,
    warnings
  );

  const fee = sentAmount - _sumValues(receivedAmounts);

  const validatorTxId = tx.txId.toString();
  const parameters: TxVerificationParameter[] = [];
  parameters.push({
    name: "validatorTxId",
    value: validatorTxId,
  });
  const validatorTx = await _getAutoRenewedValidatorTx(context, validatorTxId);
  if (validatorTx == null) {
    warnings.add(warning.VALIDATOR_NOT_FOUND);
  } else {
    parameters.push({
      name: "nodeId",
      value: validatorTx.nodeId.toString(),
    });
  }
  parameters.push({
    name: "period",
    value: tx.period.value().toString(),
  });

  return {
    recipients: [],
    values: [],
    fee: _gweiToWei(fee).toString(),
    parameters,
  };
}

async function _getAutoRenewedValidatorTx(
  context: Context.Context,
  txId: string
): Promise<pvmSerial.AddAutoRenewedValidatorTx | null> {
  const pvmApi = _getPVMApi(context.networkID);
  if (pvmApi == null) {
    return null;
  }
  try {
    const signedTx = await pvmApi.getTx({ txID: txId });
    const tx = signedTx.unsignedTx;
    return tx instanceof pvmSerial.AddAutoRenewedValidatorTx ? tx : null;
  } catch {
    return null;
  }
}

async function _getExportPTx(
  tx: pvmSerial.ExportTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  _checkCBlockchainId(context, tx.destination.toString(), warnings);
  const [utxoRecipients, utxoReceivedAmounts] = _getPOutputsData(context, tx.baseTx.outputs, warnings);
  const [exportRecipients, exportAmounts] = _getPOutputsData(context, tx.outs, warnings);
  _compareRecipients(exportRecipients, utxoRecipients, warnings);

  const utxoSentAmount = await _getPInputsData(
    context,
    tx.baseTx.inputs,
    exportRecipients.length === 1 && _isSingleAddress(exportRecipients[0]) ? [exportRecipients[0]] : undefined,
    undefined,
    warnings
  );

  const fee = utxoSentAmount - _sumValues(utxoReceivedAmounts) - _sumValues(exportAmounts);

  return {
    recipients: exportRecipients,
    values: exportAmounts.map((a) => _gweiToWei(a).toString()),
    fee: _gweiToWei(fee).toString(),
  };
}

async function _getImportPTx(
  tx: pvmSerial.ImportTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  _checkCBlockchainId(context, tx.sourceChain.toString(), warnings);

  const [recipients, receivedAmounts] = _getPOutputsData(context, tx.baseTx.outputs, warnings);

  const sentAmount = await _getPInputsData(
    context,
    tx.baseTx.inputs,
    recipients.length === 1 && _isSingleAddress(recipients[0]) ? [recipients[0]] : undefined,
    context.cBlockchainID.toString(),
    warnings
  );

  const importAmount = await _getPInputsData(
    context,
    tx.ins,
    recipients.length === 1 && _isSingleAddress(recipients[0]) ? [recipients[0]] : undefined,
    context.cBlockchainID.toString(),
    warnings
  );

  const fee = importAmount + sentAmount - _sumValues(receivedAmounts);

  return {
    recipients,
    values: receivedAmounts.map((a) => _gweiToWei(a).toString()),
    fee: _gweiToWei(fee).toString(),
  };
}

async function _getTransferPTx(
  tx: pvmSerial.BaseTx,
  context: Context.Context,
  warnings: Set<string>
): Promise<TxParams> {
  const [recipients, receivedAmounts] = _getPOutputsData(context, tx.baseTx.outputs, warnings, 2);

  const sentAmount = await _getPInputsData(
    context,
    tx.baseTx.inputs,
    recipients.length > 1 && recipients.every(_isSingleAddress) ? recipients : undefined,
    context.pBlockchainID.toString(),
    warnings
  );

  const fee = sentAmount - _sumValues(receivedAmounts);

  return {
    recipients,
    values: receivedAmounts.map((a) => _gweiToWei(a).toString()),
    fee: _gweiToWei(fee).toString(),
  };
}

/**
 * Staking rewards are paid on the C-chain to the address bound to the owner of the UTXO spent by
 * the first input (the stake's `inputAddress` when mirrored to the C-chain), not to the stake owner.
 */
async function _checkFirstInputOwner(
  context: Context.Context,
  inputs: ReadonlyArray<TransferableInput>,
  stakeOwners: Array<string>,
  warnings: Set<string>
): Promise<void> {
  if (inputs.length === 0) {
    return;
  }
  if (stakeOwners.length !== 1) {
    warnings.add(warning.REWARDS_NOT_TO_STAKE_OWNER);
    return;
  }
  if (!_isSingleAddress(stakeOwners[0])) {
    // Stake outputs with no or multiple owners are already reported by _checkOutputOwners.
    return;
  }
  const key = _utxoKey(inputs[0]);
  const found = await _findPUTXOs(context, stakeOwners[0], new Set([key]));
  if (!found.has(key)) {
    warnings.add(warning.REWARDS_NOT_TO_STAKE_OWNER);
  }
}

async function _getPInputsData(
  context: Context.Context,
  inputs: ReadonlyArray<TransferableInput>,
  addresses: Array<string> | undefined,
  blockchainId: string | undefined,
  warnings: Set<string>
): Promise<bigint> {
  const found = new Set<string>();
  if (addresses) {
    const keys = new Set(inputs.map(_utxoKey));
    for (const address of addresses) {
      const missing = new Set([...keys].filter((k) => !found.has(k)));
      for (const key of await _findPUTXOs(context, address, missing, blockchainId)) {
        found.add(key);
      }
    }
  }
  let sentAmount = BigInt(0);
  for (const input of inputs) {
    const ai = input.input;
    sentAmount += ai.amount();
    _checkPAssetId(context, input.assetId.toString(), warnings);
    if (addresses && !found.has(_utxoKey(input))) {
      warnings.add(warning.FUNDS_NOT_RETURNED);
    }
  }
  return sentAmount;
}

/**
 * Outputs with no owner have an empty address string, those with multiple owners a comma-separated list.
 */
function _isSingleAddress(address: string): boolean {
  return address !== "" && !address.includes(",");
}

/**
 * An output is spent by signatures of `threshold` of its addresses. The chain accepts threshold 0
 * only with no addresses, which makes the output spendable by anyone without a signature.
 */
function _checkOutputOwners(owners: TransferOutput["outputOwners"], warnings: Set<string>): void {
  const threshold = owners.threshold.value();
  if (threshold === 0 || owners.addrs.length === 0) {
    warnings.add(warning.ANYONE_CAN_SPEND);
  } else if (owners.addrs.length > 1) {
    warnings.add(threshold === 1 ? warning.ANY_OWNER_CAN_SPEND : warning.MULTIPLE_OWNERS_REQUIRED);
  }
}

function _getPOutputsData(
  context: Context.Context,
  outputs: ReadonlyArray<TransferableOutput>,
  warnings: Set<string>,
  expectedNumOfRecipients?: number
): [Array<string>, Array<bigint>] {
  const recipients: string[] = [];
  const receivedAmounts: bigint[] = [];
  for (const output of outputs) {
    const ao = output.output as TransferOutput;
    const addresses = ao.outputOwners.addrs;
    _checkOutputOwners(ao.outputOwners, warnings);
    const address = _addressesToString(addresses, context.hrp);
    const index = recipients.indexOf(address);
    if (index < 0) {
      recipients.push(address);
      receivedAmounts.push(ao.amount());
    } else {
      receivedAmounts[index] += ao.amount();
    }
    _checkOutputLockTime(ao.getLocktime(), warnings);
    _checkPAssetId(context, output.assetId.toString(), warnings);
  }
  if (recipients.length > (expectedNumOfRecipients ?? 1)) {
    warnings.add(warning.MULTIPLE_RECIPIENTS);
  }
  return [recipients, receivedAmounts];
}

function _utxoKey(input: TransferableInput): string {
  return `${input.utxoID.txID.toString()}:${input.utxoID.outputIdx.value()}`;
}

/**
 * Returns the UTXOs among `keys` that are owned by `address`. Pages are fetched until all of them
 * are found, the address has no more UTXOs, or MAX_UTXO_PAGES is reached.
 */
async function _findPUTXOs(
  context: Context.Context,
  address: string,
  keys: Set<string>,
  blockchainId?: string
): Promise<Set<string>> {
  const found = new Set<string>();
  if (_getPVMApi(context.networkID) == null || keys.size === 0) {
    return found;
  }

  let startIndex: { address: string; utxo: string } | undefined;
  for (let page = 0; page < MAX_UTXO_PAGES && found.size < keys.size; page++) {
    const response = await _getPVMApi(context.networkID).getUTXOs({
      addresses: [`P-${address}`],
      sourceChain: blockchainId,
      limit: UTXO_PAGE_SIZE,
      startIndex,
    });
    for (const utxo of response.utxos) {
      const key = `${utxo.utxoId.txID.toString()}:${utxo.utxoId.outputIdx.value()}`;
      if (keys.has(key)) {
        found.add(key);
      }
    }
    if (response.utxos.length < UTXO_PAGE_SIZE) {
      break;
    }
    startIndex = response.endIndex;
  }
  return found;
}

function _checkSubnetId(
  tx: pvmSerial.AddPermissionlessDelegatorTx | pvmSerial.AddPermissionlessValidatorTx,
  warnings: Set<string>
): void {
  if (tx.subnetValidator.subnetId.toString() !== networkIDs.PrimaryNetworkID.toString()) {
    warnings.add(warning.UNKNOWN_SUBNET);
  }
}

/**
 * Returns an API client whose requests time out; create one per request, as the timeout runs from creation.
 */
function _getPVMApi(networkId: number): pvm.PVMApi {
  if (!(networkId in settings.P_CHAIN_API)) {
    return null;
  }
  const uri = new URL(settings.P_CHAIN_API[networkId]).origin;
  const pvmApi = new pvm.PVMApi(uri);
  pvmApi.setFetchOptions({ signal: AbortSignal.timeout(settings.REQUEST_TIMEOUT_MS) });
  return pvmApi;
}

async function _getContext(networkId: number): Promise<Context.Context> {
  if (!(networkId in settings.P_CHAIN_API)) {
    return null;
  }
  const uri = new URL(settings.P_CHAIN_API[networkId]).origin;
  // The context is built from several requests, which cannot be aborted, so they are limited together.
  const context = await utils.withTimeout(Context.getContextFromURI(uri), settings.REQUEST_TIMEOUT_MS);
  if (context.networkID !== networkId) {
    throw new Error(`The API network ${context.networkID} does not match the expected network ${networkId}`);
  }
  return context;
}

function _addressesToString(addresses: Array<Address>, hrp: string): string {
  const items = new Array(addresses.length);
  for (let i = 0; i < addresses.length; i++) {
    items[i] = addresses[i].toString(hrp);
  }
  return items.sort().join(", ");
}

function _checkOutputLockTime(outputLockTime: bigint, warnings: Set<string>) {
  if (outputLockTime !== BigInt(0)) {
    warnings.add(warning.FUNDS_LOCKED);
  }
}

function _checkCBlockchainId(context: Context.Context, blockchainId: string, warnings: Set<string>) {
  if (blockchainId !== context.cBlockchainID) {
    warnings.add(warning.INVALID_BLOCKCHAIN);
  }
}

function _checkPBlockchainId(context: Context.Context, blockchainId: string, warnings: Set<string>) {
  if (blockchainId !== context.pBlockchainID) {
    warnings.add(warning.INVALID_BLOCKCHAIN);
  }
}

function _checkPAssetId(context: Context.Context, assetId: string, warnings: Set<string>) {
  if (assetId !== context.avaxAssetID) {
    warnings.add(warning.INVALID_ASSET);
  }
}

function _compareRecipients(recipients: Array<string>, utxoRecipients: Array<string>, warnings: Set<string>) {
  if (recipients.length !== 1) {
    return;
  }
  if (utxoRecipients.length === 0) {
    return;
  }
  if (utxoRecipients.length > 1 || utxoRecipients[0] !== recipients[0]) {
    warnings.add(warning.UNSPENT_AMOUNT_NOT_TO_RECIPIENT);
  }
}

function _sumValues(values: Array<bigint>): bigint {
  return values.reduce((p, c) => p + c, BigInt(0));
}

function _gweiToWei(gweiValue: bigint): bigint {
  return gweiValue * BigInt(1e9);
}
