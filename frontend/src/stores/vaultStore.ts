import { create } from "zustand";
import { api } from "../api/client";
import { encryptData, decryptData } from "../crypto/keys";
import { useAuthStore } from "./authStore";

export interface VaultEntry {
    id: string;
    title: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
}

export interface Vault {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

interface VaultState {
    vaults: Vault[];
    entries: Record<string, VaultEntry[]>; // vault_id → entries
    loadingVaults: boolean;
    loadingEntries: boolean;

    fetchVaults: () => Promise<void>;
    createVault: (name: string) => Promise<void>;
    deleteVault: (vaultId: string) => Promise<void>;

    fetchEntries: (vaultId: string) => Promise<void>;
    createEntry: (vaultId: string, entry: Omit<VaultEntry, "id">) => Promise<void>;
    updateEntry: (vaultId: string, entryId: string, entry: Omit<VaultEntry, "id">) => Promise<void>;
    deleteEntry: (vaultId: string, entryId: string) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
    vaults: [],
    entries: {},
    loadingVaults: false,
    loadingEntries: false,

    fetchVaults: async () => {
        set({ loadingVaults: true });
        try {
            const { data } = await api.get("/vaults/");
            const encKey = useAuthStore.getState().encKey!;

            const decrypted: Vault[] = await Promise.all(
                data.map(async (v: { id: string; name_encrypted: string; name_iv: string; created_at: string; updated_at: string }) => ({
                    id: v.id,
                    name: await decryptData<string>(encKey, {
                        data_encrypted: v.name_encrypted,
                        data_iv: v.name_iv,
                    }),
                    created_at: v.created_at,
                    updated_at: v.updated_at,
                }))
            );

            set({ vaults: decrypted });
        } finally {
            set({ loadingVaults: false });
        }
    },

    createVault: async (name) => {
        const encKey = useAuthStore.getState().encKey!;
        const encrypted = await encryptData(encKey, name);

        await api.post("/vaults/", {
            name_encrypted: encrypted.data_encrypted,
            name_iv: encrypted.data_iv,
        });

        await get().fetchVaults();
    },

    deleteVault: async (vaultId) => {
        await api.delete(`/vaults/${vaultId}`);
        set((state) => ({
            vaults: state.vaults.filter((v) => v.id !== vaultId),
            entries: Object.fromEntries(
                Object.entries(state.entries).filter(([k]) => k !== vaultId)
            ),
        }));
    },

    fetchEntries: async (vaultId) => {
        set({ loadingEntries: true });
        try {
            const { data } = await api.get(`/vaults/${vaultId}/entries`);
            const encKey = useAuthStore.getState().encKey!;

            const decrypted: VaultEntry[] = await Promise.all(
                data.map(async (e: { id: string; data_encrypted: string; data_iv: string }) => {
                    const payload = await decryptData<Omit<VaultEntry, "id">>(encKey, {
                        data_encrypted: e.data_encrypted,
                        data_iv: e.data_iv,
                    });
                    return { id: e.id, ...payload };
                })
            );

            set((state) => ({ entries: { ...state.entries, [vaultId]: decrypted } }));
        } finally {
            set({ loadingEntries: false });
        }
    },

    createEntry: async (vaultId, entry) => {
        const encKey = useAuthStore.getState().encKey!;
        const encrypted = await encryptData(encKey, entry);

        await api.post(`/vaults/${vaultId}/entries`, {
            data_encrypted: encrypted.data_encrypted,
            data_iv: encrypted.data_iv,
        });

        await get().fetchEntries(vaultId);
    },

    updateEntry: async (vaultId, entryId, entry) => {
        const encKey = useAuthStore.getState().encKey!;
        const encrypted = await encryptData(encKey, entry);

        await api.put(`/entries/${entryId}`, {
            data_encrypted: encrypted.data_encrypted,
            data_iv: encrypted.data_iv,
        });

        await get().fetchEntries(vaultId);
    },

    deleteEntry: async (vaultId, entryId) => {
        await api.delete(`/entries/${entryId}`);
        set((state) => ({
            entries: {
                ...state.entries,
                [vaultId]: (state.entries[vaultId] || []).filter((e) => e.id !== entryId),
            },
        }));
    },
}));