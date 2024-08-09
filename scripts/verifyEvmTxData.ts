import { Transaction } from "ethers";
import { verify } from "../src"
import * as txnetwork from "../src/txnetwork"
import * as utils from "../src/utils"

async function main() {
    let chainId = parseInt(process.argv[2].trim())
    if (!txnetwork.isKnownEvmNetwork(chainId)) {
        console.log("The first argument is not a supported chain id");
        return
    }
    let to = process.argv[3].trim()
    if (!utils.isHex(to)) {
        console.log("The second argument is not an address in hex");
        return
    }
    let data = process.argv[4].trim()
    if (!utils.isHex(data)) {
        console.log("The third arguments is not data in hex");
        return
    }
    let tx = Transaction.from({ chainId, to, data })
    let txHex = tx.unsignedSerialized
    console.log(`\x1b[34mTransaction hash:\x1b[0m ${txHex}`)
    let verification = await verify(txHex)
    if (verification == null) {
        console.log("Transaction verification did not succeed")
    } else {
        console.log(`\x1b[34mTransaction verification:\x1b[0m ${JSON.stringify(verification, undefined, "  ")}`)
    }
}

main()