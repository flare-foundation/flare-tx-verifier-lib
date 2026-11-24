import { concat, decodeBase64, getBytes, hexlify } from "ethers";

// Valid transactions are far smaller; the limit keeps a small compressed input from expanding without bound.
const MAX_DECOMPRESSED_BYTES = 1024 * 1024;

/**
 * Rejects if the promise is not settled within the timeout; for requests that cannot be aborted.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function toHex(value: string, prefix: boolean): string {
  if (!isHex(value)) {
    throw new Error("Not a hex value");
  }
  value = value.toLowerCase();
  if (prefix && !value.startsWith("0x")) {
    return `0x${value}`;
  }
  if (!prefix && value.startsWith("0x")) {
    return value.slice(2);
  }
  return value;
}

export function isHex(value: string): boolean {
  return /^(0x)?[A-F0-9]+$/i.test(value);
}

export function isZeroHex(value: string): boolean {
  return /^(0x)?(0+)?$/.test(value);
}

export function isBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/.test(value);
}

export function base64ToHex(base64: string): string {
  return hexlify(decodeBase64(base64)).slice(2);
}

export function isGZipped(hex: string): boolean {
  return toHex(hex, false).startsWith("1f8b08");
}

/**
 * Decompresses GZIP data given in hex; throws if it is invalid or exceeds MAX_DECOMPRESSED_BYTES.
 */
export async function decompressGZip(hex: string): Promise<string> {
  const reader = new Blob([new Uint8Array(getBytes(toHex(hex, true)))])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.length;
    if (size > MAX_DECOMPRESSED_BYTES) {
      await reader.cancel();
      throw new Error(`Decompressed data exceeds ${MAX_DECOMPRESSED_BYTES} bytes`);
    }
    chunks.push(value);
  }
  return concat(chunks).slice(2);
}
