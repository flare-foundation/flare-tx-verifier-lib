import * as contract from "../src/evm/contract"
import * as explorer from "../src/evm/contract/explorer"
import * as txnetwork from "../src/txnetwork"
import * as fs from "fs"

const REGISTRY_PATH = "src/evm/contract/registry.ts"

async function main() {
    let lines = new Array<string>()
    lines.push(`import { NetworkRegistry } from "./interface"\n`)
    lines.push("export const registry: NetworkRegistry = {")
    for (let network of txnetwork.getCChainNetworks()) {
        lines.push(`   ${network}: {`)
        let contracts = await explorer.getContracts(network)
        let flareContracts = await contract.getFlareContracts(network)
        for (let flareContract of flareContracts) {
            let address = flareContract.toLowerCase()
            let contract = contracts.filter(c => c.address === address)
            if (contract.length == 1) {
                lines.push(`        "${address}": {`)
                lines.push(`            address: "${address}",`)
                lines.push(`            name: "${contract[0].name}",`)
                lines.push(`            abi: ${contract[0].abi}`)
                lines.push(`        },`)
            }
        }
        lines.push(`    },`)
    }
    lines.push("}")
    fs.writeFileSync(REGISTRY_PATH, lines.join("\n"))
}

main()