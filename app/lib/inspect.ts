import bs58 from "bs58";
import nacl from "tweetnacl";

export type Slot = { pubkey: string; filled: boolean; valid: boolean | null };
export type Inspect = {
  version: "legacy" | number;
  bytes: number;
  feePayer: string;
  accounts: number;
  slots: Slot[];
};

function shortvec(b: Uint8Array, o: number): [number, number] {
  let len = 0, size = 0;
  for (;;) {
    const byte = b[o + size];
    len |= (byte & 0x7f) << (7 * size);
    size++;
    if ((byte & 0x80) === 0) break;
  }
  return [len, size];
}

export function inspectRaw(raw: Uint8Array): Inspect {
  const [nSigs, n] = shortvec(raw, 0);
  const msg = raw.slice(n + nSigs * 64);
  let o = 0;
  let version: "legacy" | number = "legacy";
  if (msg[0] & 0x80) { version = msg[0] & 0x7f; o = 1; }
  const numRequired = msg[o];
  o += 3;
  const [nKeys, ks] = shortvec(msg, o);
  o += ks;
  const keys: Uint8Array[] = [];
  for (let i = 0; i < nKeys; i++) keys.push(msg.slice(o + i * 32, o + (i + 1) * 32));

  const slots: Slot[] = [];
  for (let i = 0; i < numRequired; i++) {
    const sig = raw.slice(n + i * 64, n + (i + 1) * 64);
    const filled = sig.some((b) => b !== 0);
    slots.push({
      pubkey: bs58.encode(keys[i]),
      filled,
      valid: filled ? nacl.sign.detached.verify(msg, sig, keys[i]) : null,
    });
  }
  return { version, bytes: raw.length, feePayer: bs58.encode(keys[0]), accounts: nKeys, slots };
}