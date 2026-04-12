import { create } from "zustand";
import axios from "axios";

interface AuthState {
    accessToken: string | null;
    encKey: CryptoKey | null;
    email: string | null;

    setSession: (accessToken: string, encKey: CryptoKey, email: string) => void;
    setAccessToken: (token: string) => void;
    logout: () => Promise<void>;
}

function logEvent(level: "INFO" | "WARNING" | "ERROR", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "authStore", event, ...extra });
    if (level === "ERROR") console.error(payload);
    else if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

export const useAuthStore = create<AuthState>((set, get) => ({
    accessToken: null,
    encKey: null,
    email: null,

    setSession: (accessToken, encKey, email) => {
        set({ accessToken, encKey, email });
        logEvent("INFO", "session_started", { email });
    },

    setAccessToken: (token) => {
        if (!token) {
            logEvent("WARNING", "set_access_token_rejected", { reason: "empty_token" });
            return;
        }
        set({ accessToken: token });
        logEvent("INFO", "access_token_rotated");
    },

    logout: async () => {
        const { accessToken, email } = get();

        // Best-effort backend revocation. We use raw axios (not the api
        // instance) to bypass the 401 interceptor ? a failed logout must
        // not trigger a refresh loop.
        try {
            await axios.post(
                "/api/v1/auth/logout",
                {},
                {
                    withCredentials: true,
                    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                }
            );
            logEvent("INFO", "logout_backend_ok", { email });
        } catch (err) {
            // Local state is cleared regardless: forcing the user to stay
            // "logged in" when the backend is down is worse UX than the
            // residual risk of an unrevoked refresh token.
            logEvent("ERROR", "logout_backend_failed", {
                email,
                error: err instanceof Error ? err.message : String(err),
            });
        }

        set({ accessToken: null, encKey: null, email: null });
        logEvent("INFO", "session_cleared");
    },
}));