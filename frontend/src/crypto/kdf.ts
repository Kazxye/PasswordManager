import argon2 from "argon2-browser";
import { stringToUint8Array, uint8ArrayToBase64 } from "../utils/encoding";

const ARGON2_MEMORY = 65536;
const ARGON2_ITERATIONS = 3;
const ARGON2_PARALLELISM = 4;
const ARGON2_HASH_LENGTH = 64;

async function deriveSalt(email: string): Promise<Uint8Array> {
    const normalized = email.toLowerCase().trim();
    const encoded = stringToUint8Array(normalized);
    // Cast needed: TS 5.x types Uint8Array as Uint8Array<ArrayBufferLike>,
    // but Web Crypto expects BufferSource (ArrayBuffer | ArrayBufferView)
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded as BufferSource);
    return new Uint8Array(hashBuffer);
}

async function deriveMasterKey(
    password: string,
    email: string
): Promise<Uint8Array> {
    const salt = await deriveSalt(email);

    const result = await argon2.hash({
        pass: password,
        salt,
        time: ARGON2_ITERATIONS,
        mem: ARGON2_MEMORY,
        parallelism: ARGON2_PARALLELISM,
        hashLen: ARGON2_HASH_LENGTH,
        type: argon2.ArgonType.Argon2id,
    });

    return result.hash;
}

async function hkdfDerive(
    masterKey: Uint8Array,
    info: string
): Promise<Uint8Array> {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        masterKey as BufferSource,  // cast: same TS 5.x type mismatch
        { name: "HKDF" },
        false,
        ["deriveKey"]
    );

    const derived = await crypto.subtle.deriveKey(
        {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(0) as BufferSource,  // cast: same issue
            info: stringToUint8Array(info) as BufferSource,
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const raw = await crypto.subtle.exportKey("raw", derived);
    return new Uint8Array(raw);
}

export async function deriveKeys(
    password: string,
    email: string
): Promise<{ authKey: string; encKey: Uint8Array }> {
    const masterKey = await deriveMasterKey(password, email);

    const [authKeyBytes, encKey] = await Promise.all([
        hkdfDerive(masterKey, "auth"),
        hkdfDerive(masterKey, "enc"),
    ]);

    return {
        authKey: uint8ArrayToBase64(authKeyBytes),
        encKey,
    };
}