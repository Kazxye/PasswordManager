// Converts a Uint8Array to a base64 string (standard encoding, not URL-safe)
export function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Converts a base64 string back to a Uint8Array
export function base64ToUint8Array(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Encodes a UTF-8 string to Uint8Array — used to feed raw strings into crypto APIs
export function stringToUint8Array(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

// Decodes a Uint8Array back to a UTF-8 string — used after decryption
export function uint8ArrayToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

// Converts a Uint8Array to a hex string — useful for debugging key material
export function uint8ArrayToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}