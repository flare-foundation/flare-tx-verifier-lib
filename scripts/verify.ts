import { verify } from "../src"

async function main() {
    let txHex = process.argv[2].trim().toLowerCase()
        let verification = await verify(txHex)
        if (verification == null) {
            console.log("Transaction verification did not succeed")
        } else {
            console.log(JSON.stringify(verification, null, "  "))
        }
}

main()