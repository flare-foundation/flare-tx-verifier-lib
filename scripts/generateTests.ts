import { verify } from "../src";
import fs from "node:fs";

const TXS_PATH = "test/txs.json";
const TESTS_PATH = "test/tests.json";

async function main() {
  const tests: any[] = [];
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
