export function toHex(value: string, prefix: boolean): string {
    if (!isHex(value)) {
        throw new Error("Not a hex value")
    }
    value = value.toLowerCase()
    if (prefix && !value.startsWith("0x")) {
        return `0x${value}`
    }
    if (!prefix && value.startsWith("0x")) {
        return value.slice(2)
    }
    return value
}

export function isHex(value: string): boolean {
    return /^(0x)?[A-F0-9]+$/i.test(value)
}

export function isZeroHex(value: string): boolean {
    return /^(0x)?(0+)?$/.test(value)
}

export function isBase64(value: string): boolean {
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/.test(value);
}

export function base64ToHex(base64: string): string {
    return Buffer.from(base64, "base64").toString("hex")
}

export function isGZipped(hex: string): boolean {
    return toHex(hex, false).startsWith("1f8b08")
}

export async function decompressGZip(hex: string): Promise<string> {
    let decompressionStream = new DecompressionStream("gzip");
    let decompressedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from(hex, "hex"));
        controller.close();
      },
    }).pipeThrough(decompressionStream);
    let decompressedValue = await new Response(decompressedStream).arrayBuffer();
    return Buffer.from(decompressedValue).toString("hex");
}