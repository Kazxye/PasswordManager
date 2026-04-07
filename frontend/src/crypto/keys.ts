import { deriveKeys } from "./kdf";
import { encrypt, decrypt } from "./encryption";
import type { EncryptedPayload } from "./encryption";

export interface SessionKeys {
    authKey: string;
    encKey: Uint8Array;
}


export async function deriveSessionKeys(
    password: string,
    email: string
): Promise<SessionKeys> {
    return deriveKeys(password, email);
}



export async function encryptData(
    encKey: Uint8Array,
    data: object | string
): Promise<EncryptedPayload> {
    const plaintext = typeof data === "string" ? data : JSON.stringify(data);
    return encrypt(encKey, plaintext);
}


export async function decryptData<T>(
    encKey: Uint8Array,
    payload: EncryptedPayload
): Promise<T> {
    const plaintext = await decrypt(encKey, payload);
    return JSON.parse(plaintext) as T;
}