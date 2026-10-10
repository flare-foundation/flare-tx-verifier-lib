import * as contract from "../src/evm/contract";
import * as explorer from "../src/evm/contract/explorer";
import * as txnetwork from "../src/txnetwork";
import * as fs from "node:fs";

const REGISTRY_PATH = "src/evm/contract/registry.ts";

async function main() {
  const lines: string[] = [];
  lines.push(`import { NetworkRegistry } from "./interface"\n`);
  lines.push("export const registry: NetworkRegistry = {");
  for (const network of txnetwork.getCChainNetworks()) {
    lines.push(`   ${network}: {`);
    const contracts = await explorer.getContracts(network);
    const flareContracts = await contract.getFlareContracts(network);
    for (const flareContract of flareContracts) {
      const address = flareContract.toLowerCase();
      const contract = contracts.filter((c) => c.address === address);
      if (contract.length === 1) {
        lines.push(`        "${address}": {`);
        lines.push(`            address: "${address}",`);
        lines.push(`            name: "${contract[0].name}",`);
        lines.push(`            abi: ${contract[0].abi}`);
        lines.push(`        },`);
      }
    }
    lines.push(`    },`);
  }
  lines.push("}");
  fs.writeFileSync(REGISTRY_PATH, lines.join("\n"));
}

main();
