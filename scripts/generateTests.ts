import { verify } from "../src";
import type { TxVerification } from "../src/interface";
import fs from "node:fs";

const TXS_PATH = "test/txs.json";
const TESTS_PATH = "test/tests.json";

async function main() {
  const tests: Array<{ txHex: string; txVerification: TxVerification | null }> = [];
  const testTxs = JSON.parse(fs.readFileSync(TXS_PATH, "utf-8"));
  for (let i = 0; i < testTxs.length; i++) {
    const txVerification = await verify(testTxs[i]);
    tests.push({
      txHex: testTxs[i],
      txVerification,
    });
  }
  fs.writeFileSync(TESTS_PATH, JSON.stringify(tests, undefined, "  "));
}

main();
