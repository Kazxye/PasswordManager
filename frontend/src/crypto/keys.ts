import { deriveKeys } from "./kdf";
import { encrypt, decrypt } from "./encryption";
import type { EncryptedPayload } from "./encryption";

export type { EncryptedPayload };

export interface SessionKeys {
    authKey: string;
    encKey: CryptoKey;
}

export async function deriveSessionKeys(
    password: string,
    email: string
): Promise<SessionKeys> {
    return deriveKeys(password, email);
}

export async function encryptData(
    encKey: CryptoKey,
    data: object | string
): Promise<EncryptedPayload> {
    const plaintext = typeof data === "string" ? data : JSON.stringify(data);
    return encrypt(encKey, plaintext);
}

export async function decryptData<T>(
    encKey: CryptoKey,
    payload: EncryptedPayload
): Promise<T> {
    const plaintext = await decrypt(encKey, payload);

    // Vault names are encrypted as raw strings, entries as JSON objects.
    // Try parse first, fall back to raw string ? safe because decrypt()
    // already authenticated the ciphertext.
    try {
        return JSON.parse(plaintext) as T;
    } catch {
        return plaintext as unknown as T;
    }
}