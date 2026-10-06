// setup-cm.ts, run with npx tsx setup-cm.ts
import fs from "node:fs";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, keypairIdentity, some, sol } from "@metaplex-foundation/umi";
import { createCollection, mplCore } from "@metaplex-foundation/mpl-core";
import { mplCandyMachine, create, addConfigLines, findCandyGuardPda } from "@metaplex-foundation/mpl-core-candy-machine";

const umi = createUmi("https://api.devnet.solana.com").use(mplCore()).use(mplCandyMachine());

const file = "authority.json"; // add to .gitignore
const kp = fs.existsSync(file)
  ? umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))))
  : umi.eddsa.generateKeypair();
if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
umi.use(keypairIdentity(kp));
console.log("authority", kp.publicKey);

const bal = await umi.rpc.getBalance(kp.publicKey);
if (bal.basisPoints < sol(0.5).basisPoints) {
  console.log("fund this address with devnet SOL (faucet.solana.com), then run again");
  process.exit(0);
}

const collection = generateSigner(umi);
await createCollection(umi, {
  collection,
  name: "Lev Test",
  uri: "https://example.com/collection.json",
}).sendAndConfirm(umi);

const candyMachine = generateSigner(umi);
const thirdParty = generateSigner(umi);

const createIx = await create(umi, {
  candyMachine,
  collection: collection.publicKey,
  collectionUpdateAuthority: umi.identity,
  itemsAvailable: 3,
  configLineSettings: some({
    prefixName: "Lev #",
    nameLength: 3,
    prefixUri: "https://example.com/",
    uriLength: 10,
    isSequential: false,
  }),
  guards: { thirdPartySigner: some({ signerKey: thirdParty.publicKey }) },
});
await createIx.sendAndConfirm(umi);

await addConfigLines(umi, {
  candyMachine: candyMachine.publicKey,
  index: 0,
  configLines: [
    { name: "1", uri: "1.json" },
    { name: "2", uri: "2.json" },
    { name: "3", uri: "3.json" },
  ],
}).sendAndConfirm(umi);

const [guard] = findCandyGuardPda(umi, { base: candyMachine.publicKey });
const out = [
  `CM_ID=${candyMachine.publicKey}`,
  `CM_COLLECTION=${collection.publicKey}`,
  `CM_GUARD=${guard}`,
  `THIRD_PARTY_SECRET='${JSON.stringify(Array.from(thirdParty.secretKey))}'`,
].join("\n");
fs.writeFileSync("cm-output.env", out);
console.log(out);