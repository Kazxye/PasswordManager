import { useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import { encryptData, decryptData } from "../crypto/keys";
import type { EncryptedPayload } from "../crypto/keys";

function logEvent(level: "INFO" | "ERROR", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "useCrypto", event, ...extra });
    if (level === "ERROR") console.error(payload);
    else console.info(payload);
}

/**
 * Provides stable encrypt/decrypt callbacks bound to the current
 * session's encKey. Components call these without needing to know
 * about CryptoKey, base64, or the Web Crypto API.
 *
 * Throws if called without an active session (encKey is null).
 */
export function useCrypto() {
    const encKey = useAuthStore((s) => s.encKey);

    const requireKey = useCallback((): CryptoKey => {
        if (!encKey) {
            logEvent("ERROR", "encrypt_without_session");
            throw new Error("No active session — encryption key unavailable");
        }
        return encKey;
    }, [encKey]);

    const encrypt = useCallback(
        async (data: object | string): Promise<EncryptedPayload> => {
            const key = requireKey();
            return encryptData(key, data);
        },
        [requireKey]
    );

    const decrypt = useCallback(
        async <T>(payload: EncryptedPayload): Promise<T> => {
            const key = requireKey();
            return decryptData<T>(key, payload);
        },
        [requireKey]
    );

    return { encrypt, decrypt, hasKey: !!encKey };
}