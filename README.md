<div align="center">
  <a href="https://flare.network/" target="blank"> <img src="https://content.flare.network/Flare-2.svg" width="300" alt="Flare Logo" /> </a>
</div>

# Flare: Transaction verification library

The repository contains a typescript library for verification of transactions on Flare and Songbird networks, as well as on Coston and Coston2 test networks, prior to their signing.

This library mitigates the main challenges encountered during transaction signing:
1. Unauthorized alterations to the transaction without user's knowledge before sending it to the wallet.
2. The absence of visibility into the transaction's content or parameters during the signing process (i.e., blind signing).
3. Uncertainty regarding the origin of the called contract, specifically whether it was published by Flare.

## Usage

To install the library, run:
```
npm install @flarenetwork/flare-tx-verifier-lib
```
To verify a transaction (`input`), use asynchronous function `verify` that resolves to a [`TxVerification`](src/interface.ts) object or `null`:
```
import { verify } from "@flarenetwork/flare-tx-verifier-lib"

let verification = await verify(input)
```
The parameter `input` is a base64 or hex encoded unsigned C-chain or P-chain transaction. For convenience, it can also be a base64 or hex encoded GZIP compression of the transaction.

Transaction types and warning messages are exported as constants in the namespaces [`txtype`](src/txtype.ts) and [`warning`](src/warning.ts), so the output can be checked without hard-coding strings:
```
import { verify, txtype, warning } from "@flarenetwork/flare-tx-verifier-lib"

let verification = await verify(input)
if (verification?.type === txtype.CONTRACT_CALL_C) { ... }
if (verification?.warnings.includes(warning.FUNDS_LOCKED)) { ... }
```
The namespace `txtype` also provides the functions `isKnownType(type)` and `getDescription(type)`.

## About verification process

The output of the function `verify` applied to the unsigned transaction will include the following parameters (depending on the type of transaction):

| Output parameter | Description |
| :----: | ----- | 
| network 					      | Network name, e.g. Flare Mainnet. For non-flare networks, chainID is returned. |
| type 						        | Possible transaction types are "transferC", "contractCallC", "exportC", "importC", "exportP", "importP", "transferP", "addDelegatorP", "addValidatorP", "addAutoRenewedValidatorP", "updateAutoRenewedValidatorP", "removeAutoRenewedValidatorP" |
| description 				    | Description of the transaction type: "Funds transfer on C-chain", "Contract call on C-chain", "Export from C-chain", "Import to C-chain", "Export from P-chain", "Import to P-chain", "Funds transfer on P-chain", "Stake on P-chain", "Add validator on P-chain", "Add auto-renewed validator on P-chain", "Update auto-renewed validator on P-chain", "Remove auto-renewed validator on P-chain". |
| recipients  				    | Recipient(s) of funds or the address of the contract called. |
| values      				    | Amount of funds transferred or staked stated in WEI. |
| fee         				    | Transfer fee stated (if specified in transaction) stated in WEI.  |              
| contractName      		  | When calling a C-chain contract, its name will be returned (if it exists).  |               	
| contractMethod   			  | When calling a C-chain contract, the method called will be returned (if it can be decoded). |
| contractMethodABI   			  | When calling a C-chain contract, the ABI specification of the method called will be returned in JSON string format. |                  
| contractData      		  | When calling a C-chain contract, the data field is returned (in hex format). |
| isFlareNetworkContract 	| When calling a C-chain contract, it returns true/false, depending if the contract was deployed by Flare. |
| parameters				      | When calling a C-chain contract, the method's parameters are returned. For staking and validator types ("addDelegatorP", "addValidatorP", "addAutoRenewedValidatorP", "updateAutoRenewedValidatorP", "removeAutoRenewedValidatorP"), additional staking parameters are returned. |
| safeTxData                | When calling a C-chain contract to execute a safe transaction (i.e., a transaction that is initiated from a Safe smart account), an object containing the decoded data of the safe transaction is returned. If the safe transaction is a contract call, the object contains the following properties (described above): contractName, contractMethod, contractMethodABI, isFlareNetworkContract, parameters. |
| warnings					      | Warnings are returned for suspicious data (e.g., "Funds will be locked after transfer."). |
| messageToSign	  			  | Hash sent to the wallet to sign. Useful for confirming P-chain transactions. |

When staking, the returned staking parameters are the following:
| Parameters | Description |
| :----: | ----- | 
| nodeId | Identifier of the validator node that you want to stake to. |
| startTime | Proposed starting time of the stake (in unix time). Not returned for auto-renewed validators, which start validating as soon as the transaction is accepted. |
| endTime | Proposed ending time of the stake (in unix time). Not returned for auto-renewed validators. |
| delegationFee | Proposed node fee in % (if you want to initialize staking on a validator node). |
| period | Auto-renewed validators only. Duration of a validation period in seconds, after which the validation is automatically renewed. When updating, it applies to the subsequent validation periods. Zero (type "removeAutoRenewedValidatorP") means the validation is not renewed after the current validation period, and the stake is then returned. |
| validatorAuthority | Auto-renewed validators only (when adding). Address that can update or remove the validator. |
| validatorTxId | Auto-renewed validators only (when updating or removing). Identifier of the transaction that added the validator. |
