import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../stores/authStore";

declare module "axios" {
    interface InternalAxiosRequestConfig {
        _retry?: boolean;
    }
}

function logEvent(level: "INFO" | "WARNING" | "ERROR", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "apiClient", event, ...extra });
    if (level === "ERROR") console.error(payload);
    else if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

export const api = axios.create({
    baseURL: "/api/v1",
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
type QueueEntry = {
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
};
let queue: QueueEntry[] = [];

function flushQueue(token: string | null, err: unknown = null): void {
    queue.forEach(({ resolve, reject }) => {
        if (token) resolve(token);
        else reject(err);
    });
    queue = [];
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig | undefined;

        if (!error.response || !original) {
            logEvent("WARNING", "request_failed_no_response", {
                error: error.message,
                url: original?.url,
            });
            return Promise.reject(error);
        }

        if (error.response.status !== 401 || original._retry) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                queue.push({
                    resolve: (token) => {
                        original.headers.Authorization = `Bearer ${token}`;
                        resolve(api(original));
                    },
                    reject,
                });
            });
        }

        original._retry = true;
        isRefreshing = true;
        logEvent("INFO", "refresh_attempted", { url: original.url });

        try {
            const { data } = await axios.post(
                "/api/v1/auth/refresh",
                {},
                { withCredentials: true }
            );

            const newToken: string | undefined = data?.access_token;
            if (!newToken) {
                // eslint-disable-next-line no-throw-literal
                throw new Error("refresh response missing access_token");
            }

            useAuthStore.getState().setAccessToken(newToken);
            logEvent("INFO", "refresh_succeeded");

            flushQueue(newToken);

            original.headers.Authorization = `Bearer ${newToken}`;
            logEvent("INFO", "request_retried_after_refresh", { url: original.url });
            return api(original);
        } catch (refreshError) {
            logEvent("ERROR", "refresh_failed", {
                error: refreshError instanceof Error ? refreshError.message : String(refreshError),
            });

            flushQueue(null, refreshError);

            useAuthStore.getState().logout().catch(() => { /* logged in store */ });

            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);