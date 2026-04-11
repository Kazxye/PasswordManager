import axios from "axios";
import { useAuthStore } from "../stores/authStore";

// Extends Axios config type to include _retry flag used by the 401 interceptor
declare module "axios" {
    interface InternalAxiosRequestConfig {
        _retry?: boolean;
    }
}

export const api = axios.create({
    baseURL: "/api/v1",
    withCredentials: true,
});

// Injects JWT into every outgoing request
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status !== 401 || original._retry) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            // Queue concurrent requests while refresh is in progress
            return new Promise((resolve) => {
                queue.push((token) => {
                    original.headers.Authorization = `Bearer ${token}`;
                    resolve(api(original));
                });
            });
        }

        original._retry = true;
        isRefreshing = true;

        try {
            const { data } = await axios.post(
                "/api/v1/auth/refresh",
                {},
                {
                    // Raw axios (not api instance) to avoid triggering this interceptor again
                    withCredentials: true,
                    headers: {
                        Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
                    },
                }
            );

            const newToken: string = data.access_token;
            useAuthStore.getState().setAccessToken(newToken);

            queue.forEach((cb) => cb(newToken));
            queue = [];

            original.headers.Authorization = `Bearer ${newToken}`;
            return api(original);
        } catch (refreshError) {
            // Refresh failed — session is invalid, force logout
            useAuthStore.getState().logout();
            queue = [];
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);