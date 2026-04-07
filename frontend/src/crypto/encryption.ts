import {
    uint8ArrayToBase64,
    base64ToUint8Array,
    uint8ArrayToString,
    stringToUint8Array,
} from "../utils/encoding";

// Payload stored per entry in the database
export interface EncryptedPayload {
    data_encrypted: string; // base64 ciphertext
    data_iv: string;        // base64 IV (12 bytes)
}

// Imports raw enc_key bytes as a CryptoKey usable for AES-GCM operations
async function importEncKey(encKey: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        encKey as BufferSource,
        { name: "AES-GCM" },
        false,           // not extractable — key never leaves memory as raw bytes again
        ["encrypt", "decrypt"]
    );
}

// Encrypts a plaintext string using AES-256-GCM.
// A fresh random 96-bit IV is generated per call — never reuse IV with the same key.
export async function encrypt(
    encKey: Uint8Array,
    plaintext: string
): Promise<EncryptedPayload> {
    const key = await importEncKey(encKey);

    // 96-bit IV is the recommended size for AES-GCM — NIST SP 800-38D
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        stringToUint8Array(plaintext) as BufferSource
    );

    return {
        data_encrypted: uint8ArrayToBase64(new Uint8Array(ciphertext)),
        data_iv: uint8ArrayToBase64(iv),
    };
}

// Decrypts an EncryptedPayload using AES-256-GCM.
// AES-GCM provides authentication — if the ciphertext was tampered, this throws.
export async function decrypt(
    encKey: Uint8Array,
    payload: EncryptedPayload
): Promise<string> {
    const key = await importEncKey(encKey);
    const iv = base64ToUint8Array(payload.data_iv);
    const ciphertext = base64ToUint8Array(payload.data_encrypted);

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        ciphertext as BufferSource
    );

    return uint8ArrayToString(new Uint8Array(plaintext));
}