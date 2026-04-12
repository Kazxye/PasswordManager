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
    entries: Record<string, VaultEntry[]>;
    loadingVaults: boolean;
    loadingEntries: boolean;

    fetchVaults: () => Promise<void>;
    createVault: (name: string) => Promise<void>;
    deleteVault: (vaultId: string) => Promise<void>;

    fetchEntries: (vaultId: string) => Promise<void>;
    createEntry: (vaultId: string, entry: Omit<VaultEntry, "id">) => Promise<void>;
    updateEntry: (vaultId: string, entryId: string, entry: Omit<VaultEntry, "id">) => Promise<void>;
    deleteEntry: (vaultId: string, entryId: string) => Promise<void>;

    reset: () => void;
}

function logEvent(level: "INFO" | "WARNING" | "ERROR", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "vaultStore", event, ...extra });
    if (level === "ERROR") console.error(payload);
    else if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

function getEncKey(): CryptoKey {
    const encKey = useAuthStore.getState().encKey;
    if (!encKey) {
        logEvent("ERROR", "enc_key_missing");
        throw new Error("Session expired");
    }
    return encKey;
}

async function safeDecrypt<T>(
    encKey: CryptoKey,
    payload: { data_encrypted: string; data_iv: string },
    context: { kind: "vault" | "entry"; id: string }
): Promise<T> {
    try {
        return await decryptData<T>(encKey, payload);
    } catch (err) {
        logEvent("ERROR", "decrypt_failed", {
            kind: context.kind,
            id: context.id,
            error: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
}

export const useVaultStore = create<VaultState>((set) => ({
    vaults: [],
    entries: {},
    loadingVaults: false,
    loadingEntries: false,

    fetchVaults: async () => {
        set({ loadingVaults: true });
        try {
            const { data } = await api.get("/vaults/");
            const encKey = getEncKey();

            const decrypted: Vault[] = await Promise.all(
                data.map(async (v: { id: string; name_encrypted: string; name_iv: string; created_at: string; updated_at: string }) => ({
                    id: v.id,
                    name: await safeDecrypt<string>(
                        encKey,
                        { data_encrypted: v.name_encrypted, data_iv: v.name_iv },
                        { kind: "vault", id: v.id }
                    ),
                    created_at: v.created_at,
                    updated_at: v.updated_at,
                }))
            );

            set({ vaults: decrypted });
            logEvent("INFO", "vaults_fetched", { count: decrypted.length });
        } catch (err) {
            logEvent("ERROR", "fetch_vaults_failed", {
                error: err instanceof Error ? err.message : String(err),
            });
            throw err;
        } finally {
            set({ loadingVaults: false });
        }
    },

    createVault: async (name) => {
        const encKey = getEncKey();
        const encrypted = await encryptData(encKey, name);

        const { data } = await api.post("/vaults/", {
            name_encrypted: encrypted.data_encrypted,
            name_iv: encrypted.data_iv,
        });

        set((state) => ({
            vaults: [
                ...state.vaults,
                {
                    id: data.id,
                    name,
                    created_at: data.created_at,
                    updated_at: data.created_at,
                },
            ],
        }));

        logEvent("INFO", "vault_created", { id: data.id });
    },

    deleteVault: async (vaultId) => {
        await api.delete(`/vaults/${vaultId}`);
        set((state) => {
            const newEntries = { ...state.entries };
            delete newEntries[vaultId];
            return {
                vaults: state.vaults.filter((v) => v.id !== vaultId),
                entries: newEntries,
            };
        });
        logEvent("INFO", "vault_deleted", { id: vaultId });
    },

    fetchEntries: async (vaultId) => {
        set({ loadingEntries: true });
        try {
            const { data } = await api.get(`/vaults/${vaultId}/entries`);
            const encKey = getEncKey();

            const decrypted: VaultEntry[] = await Promise.all(
                data.map(async (e: { id: string; data_encrypted: string; data_iv: string }) => {
                    const payload = await safeDecrypt<Omit<VaultEntry, "id">>(
                        encKey,
                        { data_encrypted: e.data_encrypted, data_iv: e.data_iv },
                        { kind: "entry", id: e.id }
                    );
                    return { id: e.id, ...payload };
                })
            );

            set((state) => ({ entries: { ...state.entries, [vaultId]: decrypted } }));
            logEvent("INFO", "entries_fetched", { vault_id: vaultId, count: decrypted.length });
        } catch (err) {
            logEvent("ERROR", "fetch_entries_failed", {
                vault_id: vaultId,
                error: err instanceof Error ? err.message : String(err),
            });
            throw err;
        } finally {
            set({ loadingEntries: false });
        }
    },

    createEntry: async (vaultId, entry) => {
        const encKey = getEncKey();
        const encrypted = await encryptData(encKey, entry);

        const { data } = await api.post(`/vaults/${vaultId}/entries`, {
            data_encrypted: encrypted.data_encrypted,
            data_iv: encrypted.data_iv,
        });

        set((state) => ({
            entries: {
                ...state.entries,
                [vaultId]: [...(state.entries[vaultId] || []), { id: data.id, ...entry }],
            },
        }));

        logEvent("INFO", "entry_created", { vault_id: vaultId, id: data.id });
    },

    updateEntry: async (vaultId, entryId, entry) => {
        const encKey = getEncKey();
        const encrypted = await encryptData(encKey, entry);

        await api.put(`/entries/${entryId}`, {
            data_encrypted: encrypted.data_encrypted,
            data_iv: encrypted.data_iv,
        });

        set((state) => ({
            entries: {
                ...state.entries,
                [vaultId]: (state.entries[vaultId] || []).map((e) =>
                    e.id === entryId ? { id: entryId, ...entry } : e
                ),
            },
        }));

        logEvent("INFO", "entry_updated", { vault_id: vaultId, id: entryId });
    },

    deleteEntry: async (vaultId, entryId) => {
        await api.delete(`/entries/${entryId}`);
        set((state) => ({
            entries: {
                ...state.entries,
                [vaultId]: (state.entries[vaultId] || []).filter((e) => e.id !== entryId),
            },
        }));
        logEvent("INFO", "entry_deleted", { vault_id: vaultId, id: entryId });
    },

    reset: () => {
        set({ vaults: [], entries: {}, loadingVaults: false, loadingEntries: false });
        logEvent("INFO", "store_reset");
    },
}));

useAuthStore.subscribe((state, prevState) => {
    if (prevState.accessToken && !state.accessToken) {
        useVaultStore.getState().reset();
    }
});