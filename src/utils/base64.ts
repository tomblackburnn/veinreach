/** Binary <-> base64 helpers that work in browsers and Node. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Run-length encode a byte array: pairs of (count<=255, value). Great for sparse tile data. */
export function rleEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const v = data[i];
    let n = 1;
    while (i + n < data.length && data[i + n] === v && n < 255) n++;
    out.push(n, v);
    i += n;
  }
  return Uint8Array.from(out);
}

export function rleDecode(data: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    const n = data[i];
    const v = data[i + 1];
    out.fill(v, o, Math.min(length, o + n));
    o += n;
  }
  return out;
}
