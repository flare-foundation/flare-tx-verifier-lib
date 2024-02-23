import { TxVerification } from "./interface"
import { verify as verifyEvm } from "./evm"
import { verify as verifyAvax } from "./avax"
import * as utils from "./utils"

export * from "./interface"
export * from "./txtype"

export async function verify(input: string): Promise<TxVerification | null> {
    let txHex = await _tryConvertToTxHex(input)
    
    if (txHex == null) {
        return null
    }

    let verification: TxVerification | null
    
    verification = await verifyEvm(txHex)
    if (verification != null) {
        return verification
    }

    verification = await verifyAvax(txHex)
    if (verification != null) {
        return verification
    }

    return null
}

async function _tryConvertToTxHex(input: string): Promise<string | null> {
    if (utils.isBase64(input)) {
        try { input = utils.base64ToHex(input) } catch { }
    }
    if (!utils.isHex(input)) {
        return null
    }
    if (utils.isGZipped(input)) {
        try { input = await utils.decompressGZip(input) } catch { }
    }
    return input
}