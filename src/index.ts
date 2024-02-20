import { TxVerification } from "./interface"
import { verify as verifyEvm } from "./evm"
import { verify as verifyAvax } from "./avax"
import * as utils from "./utils"

export * from "./interface"
export * from "./txtype"

export async function verify(txHex: string): Promise<TxVerification | null> {
    let verification: TxVerification | null

    if (utils.isHex(txHex)) {
        return null
    }

    if (utils.isGZipped(txHex)) {
        try { txHex = await utils.decompressGZip(txHex) } catch { }
    }
    
    verification= await verifyEvm(txHex)
    if (verification != null) {
        return verification
    }

    verification = await verifyAvax(txHex)
    if (verification != null) {
        return verification
    }

    return null
}