import {
    uint8ArrayToBase64,
    base64ToUint8Array,
    uint8ArrayToString,
    stringToUint8Array,
} from "../utils/encoding";

export interface EncryptedPayload {
    data_encrypted: string;
    data_iv: string;
}

// 96-bit IV per NIST SP 800-38D. Larger gets hashed down, smaller is non-compliant.
const IV_LENGTH_BYTES = 12;

export async function encrypt(
    encKey: CryptoKey,
    plaintext: string
): Promise<EncryptedPayload> {
    // Random IV per call. AES-GCM catastrophically breaks on (key, IV) reuse:
    // an attacker can recover the auth key and forge ciphertexts.
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));

    try {
        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv as BufferSource },
            encKey,
            stringToUint8Array(plaintext) as BufferSource
        );

        return {
            data_encrypted: uint8ArrayToBase64(new Uint8Array(ciphertext)),
            data_iv: uint8ArrayToBase64(iv),
        };
    } catch (err) {
        console.error(JSON.stringify({
            level: "ERROR",
            component: "encryption",
            event: "encrypt_failed",
            error: err instanceof Error ? err.message : String(err),
        }));
        throw new Error("Encryption failed");
    }
}

export async function decrypt(
    encKey: CryptoKey,
    payload: EncryptedPayload
): Promise<string> {
    const iv = base64ToUint8Array(payload.data_iv);
    const ciphertext = base64ToUint8Array(payload.data_encrypted);

    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv as BufferSource },
            encKey,
            ciphertext as BufferSource
        );
        return uint8ArrayToString(new Uint8Array(plaintext));
    } catch (err) {
        // High-signal Blue Team event: spike in decrypt failures for one
        // user suggests tampering, key mismatch, or corruption.
        console.error(JSON.stringify({
            level: "ERROR",
            component: "encryption",
            event: "decrypt_failed",
            ciphertext_length: ciphertext.length,
            error: err instanceof Error ? err.message : String(err),
        }));
        throw new Error("Decryption failed");
    }
}