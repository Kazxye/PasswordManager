import * as argon2 from "argon2-browser";
import { stringToUint8Array, uint8ArrayToBase64 } from "../utils/encoding";

const ARGON2_MEMORY = 65536;
const ARGON2_ITERATIONS = 3;
const ARGON2_PARALLELISM = 4;
const ARGON2_HASH_LENGTH = 64;
const HKDF_OUTPUT_BITS = 256;

// Deterministic salt: avoids a pre-login round-trip and prevents the
// server from leaking account existence via salt lookups.
async function deriveSalt(email: string): Promise<Uint8Array> {
    const normalized = email.toLowerCase().trim();
    const encoded = stringToUint8Array(normalized);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded as BufferSource);
    return new Uint8Array(hashBuffer);
}

async function deriveMasterKeyMaterial(
    password: string,
    email: string
): Promise<CryptoKey> {
    const salt = await deriveSalt(email);

    const startedAt = performance.now();
    const result = await argon2.hash({
        pass: password,
        salt,
        time: ARGON2_ITERATIONS,
        mem: ARGON2_MEMORY,
        parallelism: ARGON2_PARALLELISM,
        hashLen: ARGON2_HASH_LENGTH,
        type: argon2.ArgonType.Argon2id,
    });
    const elapsedMs = Math.round(performance.now() - startedAt);

    console.info(JSON.stringify({
        level: "INFO",
        component: "kdf",
        event: "argon2_derivation_completed",
        elapsed_ms: elapsedMs,
    }));

    const masterKey = await crypto.subtle.importKey(
        "raw",
        result.hash as BufferSource,
        { name: "HKDF" },
        false,
        ["deriveKey", "deriveBits"]
    );

    // Best-effort wipe ? not guaranteed (engines may have copied),
    // but closes the obvious window where master_key sits in JS heap.
    result.hash.fill(0);

    return masterKey;
}

// Empty HKDF salt is safe per RFC 5869 ?3.1: master_key is already
// high-entropy from Argon2id, so HKDF-Extract with zero salt is fine.
function hkdfParams(info: string): HkdfParams {
    return {
        name: "HKDF",
        hash: "SHA-256",
        salt: new Uint8Array(0) as BufferSource,
        info: stringToUint8Array(info) as BufferSource,
    };
}

// deriveBits (not deriveKey + exportKey): auth_key is never used as an
// AES key on the client, only sent to the server as base64.
async function deriveAuthKey(masterKey: CryptoKey): Promise<Uint8Array> {
    const bits = await crypto.subtle.deriveBits(
        hkdfParams("auth"),
        masterKey,
        HKDF_OUTPUT_BITS
    );
    return new Uint8Array(bits);
}

// extractable=false is the core of the hardening: enc_key never appears
// as raw bytes in JS-readable form after this call.
async function deriveEncKey(masterKey: CryptoKey): Promise<CryptoKey> {
    return crypto.subtle.deriveKey(
        hkdfParams("enc"),
        masterKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export interface DerivedKeys {
    authKey: string;
    encKey: CryptoKey;
}

export async function deriveKeys(
    password: string,
    email: string
): Promise<DerivedKeys> {
    try {
        const masterKey = await deriveMasterKeyMaterial(password, email);

        const [authKeyBytes, encKey] = await Promise.all([
            deriveAuthKey(masterKey),
            deriveEncKey(masterKey),
        ]);

        return {
            authKey: uint8ArrayToBase64(authKeyBytes),
            encKey,
        };
    } catch (err) {
        console.error(JSON.stringify({
            level: "ERROR",
            component: "kdf",
            event: "key_derivation_failed",
            error: err instanceof Error ? err.message : String(err),
        }));
        throw new Error("Key derivation failed");
    }
}