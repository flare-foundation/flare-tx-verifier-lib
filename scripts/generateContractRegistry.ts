import * as explorer from "../src/evm/contract/explorer";
import * as repository from "../src/evm/contract/repository";
import * as txnetwork from "../src/txnetwork";
import { createHash } from "node:crypto";
import * as fs from "node:fs";

const REGISTRY_PATH = "src/evm/contract/registry.json";

async function main() {
  // Each distinct ABI is stored once, keyed by a hash of its content.
  const abis = new Map<string, string>();
  const contracts = new Map<number, Array<[string, { name: string; abi: string }]>>();

  for (const network of txnetwork.getCChainNetworks()) {
    const entries: Array<[string, { name: string; abi: string }]> = [];
    const explorerContracts = await explorer.getContracts(network);
    const flareContracts = await _getFlareContracts(network);
    for (const flareContract of flareContracts) {
      const address = flareContract.toLowerCase();
      const matches = explorerContracts.filter((c) => c.address === address);
      if (matches.length !== 1) {
        continue;
      }
      // Normalize formatting so ABIs that differ only in whitespace are stored once.
      const abi = JSON.stringify(JSON.parse(matches[0].abi as string));
      const hash = createHash("sha256").update(abi).digest("hex").slice(0, 16);
      const existing = abis.get(hash);
      if (existing !== undefined && existing !== abi) {
        throw new Error(`ABI hash collision for ${hash}`);
      }
      abis.set(hash, abi);
      entries.push([address, { name: matches[0].name, abi: hash }]);
    }
    contracts.set(network, entries);
  }

  // One ABI / contract per line keeps diffs readable between regenerations.
  const lines: string[] = [];
  lines.push("{");
  lines.push('  "abis": {');
  const hashes = [...abis.keys()].sort();
  hashes.forEach((hash, i) => {
    lines.push(`    ${JSON.stringify(hash)}: ${abis.get(hash)}${i < hashes.length - 1 ? "," : ""}`);
  });
  lines.push("  },");
  lines.push('  "contracts": {');
  const networks = [...contracts.keys()];
  networks.forEach((network, n) => {
    lines.push(`    "${network}": {`);
    const entries = contracts.get(network);
    entries.forEach(([address, entry], i) => {
      lines.push(`      ${JSON.stringify(address)}: ${JSON.stringify(entry)}${i < entries.length - 1 ? "," : ""}`);
    });
    lines.push(`    }${n < networks.length - 1 ? "," : ""}`);
  });
  lines.push("  }");
  lines.push("}");
  fs.writeFileSync(REGISTRY_PATH, `${lines.join("\n")}\n`);

  console.log(
    `Wrote ${REGISTRY_PATH}: ${hashes.length} ABIs, ${[...contracts.values()].reduce((s, e) => s + e.length, 0)} contracts`
  );
}

async function _getFlareContracts(network: number): Promise<Array<string>> {
  const addresses = [
    ...(await repository.getAddressesOfFlareSmartContractsV1(network)),
    ...(await repository.getAddressesOfFlareSmartContractsV2(network)),
    ...(await repository.getAddressesOfFlareFassetContracts(network)),
  ];
  return [...new Set(addresses)];
}

main();
