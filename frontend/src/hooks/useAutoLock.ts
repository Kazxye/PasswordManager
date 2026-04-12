import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — matches ARCHITECTURE.md spec

// Events that prove the user is actively present.
// Covers keyboard, mouse, touch, and scroll.
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
    "mousedown",
    "keydown",
    "touchstart",
    "scroll",
];

function logEvent(level: "INFO" | "WARNING", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "autoLock", event, ...extra });
    if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

/**
 * Monitors user activity and locks the session after LOCK_TIMEOUT_MS
 * of inactivity. "Locking" means full logout: enc_key wiped from
 * memory, JWT cleared, vault data purged.
 *
 * Also registers a beforeunload handler to clear sensitive state
 * when the tab is closed or navigated away.
 *
 * Only activates when a session exists (accessToken !== null).
 */
export function useAutoLock(): void {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const accessToken = useAuthStore((s) => s.accessToken);

    const lock = useCallback(async () => {
        logEvent("WARNING", "session_locked_inactivity", {
            timeout_ms: LOCK_TIMEOUT_MS,
        });
        await useAuthStore.getState().logout();
    }, []);

    const resetTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(lock, LOCK_TIMEOUT_MS);
    }, [lock]);

    // Inactivity timer — only runs while authenticated
    useEffect(() => {
        if (!accessToken) return;

        resetTimer();

        const onActivity = () => resetTimer();

        for (const event of ACTIVITY_EVENTS) {
            window.addEventListener(event, onActivity, { passive: true });
        }

        logEvent("INFO", "auto_lock_armed", { timeout_ms: LOCK_TIMEOUT_MS });

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            for (const event of ACTIVITY_EVENTS) {
                window.removeEventListener(event, onActivity);
            }
            logEvent("INFO", "auto_lock_disarmed");
        };
    }, [accessToken, resetTimer]);

    // beforeunload — wipe sensitive state when tab closes.
    // Uses the sync path (set state directly) because async
    // operations are unreliable in beforeunload.
    useEffect(() => {
        const onUnload = () => {
            useAuthStore.setState({
                accessToken: null,
                encKey: null,
                email: null,
            });
            // vaultStore.reset() fires automatically via the subscribe()
            // in vaultStore.ts when accessToken transitions to null.
        };

        window.addEventListener("beforeunload", onUnload);
        return () => window.removeEventListener("beforeunload", onUnload);
    }, []);
}