import axios from "axios";
import { useAuthStore } from "../stores/authStore";

export const api = axios.create({
    baseURL: "/api/v1",
    withCredentials: true,
});

// Injeta o JWT em toda request
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
                    withCredentials: true,
                    headers: {
                        Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
                    },
                }
            );

            const newToken = data.access_token;
            useAuthStore.getState().setAccessToken(newToken);
            queue.forEach((cb) => cb(newToken));
            queue = [];

            original.headers.Authorization = `Bearer ${newToken}`;
            return api(original);
        } catch {
            useAuthStore.getState().logout();
            queue = [];
            return Promise.reject(error);
        } finally {
            isRefreshing = false;
        }
    }
);