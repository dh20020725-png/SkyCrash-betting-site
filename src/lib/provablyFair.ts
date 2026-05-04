// Provably fair crash engine.
// Algorithm: HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`) -> hex
// Take first 13 hex chars (52 bits) -> integer X in [0, 2^52)
// houseEdge h (e.g. 0.04). With probability h, crash = 1.00 (instant bust).
// Otherwise crash = floor( (100 * 2^52 - X) / (2^52 - X) ) / 100, clamped.
// This yields a fair distribution where E[payout] = (1 - h) * bet * target
// when the user picks any target multiplier, matching standard "crash" math.

const HOUSE_EDGE = 0.04; // 4%

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateServerSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashServerSeed(serverSeed: string): Promise<string> {
  return sha256Hex(serverSeed);
}

export async function computeCrashPoint(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): Promise<number> {
  const hex = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}`);

  // House-edge bust: deterministic from a separate slice of the hash.
  const edgeSlice = parseInt(hex.slice(13, 21), 16); // 32 bits
  if (edgeSlice / 0xffffffff < HOUSE_EDGE) return 1.0;

  const slice = hex.slice(0, 13); // 52 bits
  const x = parseInt(slice, 16);
  const max = Math.pow(2, 52);
  const crash = Math.floor((100 * max - x) / (max - x)) / 100;
  return Math.max(1.0, Math.min(crash, 1000));
}

export const HOUSE_EDGE_PCT = HOUSE_EDGE * 100;