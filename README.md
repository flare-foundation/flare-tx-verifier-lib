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
To verify a transaction hash (`txHex`), use asynchronous function `verify` that resolves to a [`TxVerification`](src/interface.ts) object or `null`:
```
import { verify } from "@flarenetwork/flare-tx-verifier-lib"

let verification = await verify(txHex)
```

## About verification process

The output of the function `verify` applied to the unsigned transaction will include the following parameters (depending on the type of transaction):

| Output parameter | Description |
| :----: | ----- | 
| network 					      | Network name, e.g. Flare Mainnet. For non-flare networks, chainID is returned. |
| type 						        | Possible transaction types are "transferC", "contractCallC", "exportC", "importC", "exportP", "importP", "addDelegatorP", "addValidatorP" |
| description 				    | Description of the transaction type: "Funds transfer on C-chain", "Contract call on C-chain", "Export from C-chain", "Import to C-chain", "Export from P-chain", "Import to P-chain", "Stake on P-chain", "Add validator on P-chain". |                 
| recipients  				    | Recipient(s) of funds or the address of the contract called. |
| values      				    | Amount of funds transferred or staked stated in WEI. |
| fee         				    | Transfer fee stated (if specified in transaction) stated in WEI.  |              
| contractName      		  | When calling a C-chain contract, its name will be returned (if it exists).  |               	
| contractMethod   			  | When calling a C-chain contract, the method called will be returned (if it can be decoded). |                  
| contractData      		  | When calling a C-chain contract, the data field is returned (in hex format). |
| isFlareNetworkContract 	| When calling a C-chain contract, it returns true/false, depending if the contract was deployed by Flare. |
| parameters				      | When calling a C-chain contract, the method's parameters are returned. For types "addDelegatorP" and "addValidatorP", additional staking parameters are returned. |
| warnings					      | Warnings are returned for suspicious data (e.g., "Not official Flare contract"). |
| messageToSign	  			  | Hash sent to the wallet to sign. Useful for confirming P-chain transactions. |

When staking, the returned staking parameters are the following:
| Parameters | Description |
| :----: | ----- | 
| nodeId | Identifier of the validator node that you want to stake to. |
| startTime | Proposed starting time of the stake (in unix time). |
| endTime | Proposed ending time of the stake (in unix time). |
| validatorFee | Proposed node fee in % multiplied by 10000 (if you want to initialize staking on a validator node). |
