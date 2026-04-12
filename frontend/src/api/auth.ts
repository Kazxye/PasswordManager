import { api } from "./client";
import { deriveSessionKeys } from "../crypto/keys";
import { useAuthStore } from "../stores/authStore";

function logEvent(level: "INFO" | "WARNING" | "ERROR", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "apiAuth", event, ...extra });
    if (level === "ERROR") console.error(payload);
    else if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

/**
 * Derives crypto keys from credentials, then registers the user.
 * Does NOT auto-login — the caller should redirect to login page
 * so the user consciously starts a session.
 */
export async function register(email: string, password: string): Promise<void> {
    const normalized = email.toLowerCase().trim();

    logEvent("INFO", "register_started", { email: normalized });

    const { authKey } = await deriveSessionKeys(password, normalized);

    await api.post("/auth/register", {
        email: normalized,
        auth_key: authKey,
    });

    logEvent("INFO", "register_succeeded", { email: normalized });
}

/**
 * Derives crypto keys, authenticates with the backend, and
 * initializes the full session (JWT + encKey in memory).
 */
export async function login(email: string, password: string): Promise<void> {
    const normalized = email.toLowerCase().trim();

    logEvent("INFO", "login_started", { email: normalized });

    const { authKey, encKey } = await deriveSessionKeys(password, normalized);

    const { data } = await api.post("/auth/login", {
        email: normalized,
        auth_key: authKey,
    });

    const accessToken: string | undefined = data?.access_token;
    if (!accessToken) {
        logEvent("ERROR", "login_missing_token", { email: normalized });
        throw new Error("Login response missing access_token");
    }

    useAuthStore.getState().setSession(accessToken, encKey, normalized);

    logEvent("INFO", "login_succeeded", { email: normalized });
}

/**
 * Delegates entirely to authStore.logout() which handles backend
 * revocation + local state cleanup. Exists here so pages import
 * everything auth-related from a single module.
 */
export async function logout(): Promise<void> {
    await useAuthStore.getState().logout();
}