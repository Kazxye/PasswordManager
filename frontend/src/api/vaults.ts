import { api } from "./client";

function logEvent(level: "INFO" | "WARNING" | "ERROR", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "apiVaults", event, ...extra });
    if (level === "ERROR") console.error(payload);
    else if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

// --- Response shapes from the backend ---

export interface VaultResponse {
    id: string;
    name_encrypted: string;  // base64
    name_iv: string;         // base64
    created_at: string;
    updated_at: string;
}

export interface EntryResponse {
    id: string;
    data_encrypted: string;  // base64
    data_iv: string;         // base64
    created_at: string;
    updated_at: string;
}

// --- Vaults ---

export async function listVaults(): Promise<VaultResponse[]> {
    const { data } = await api.get<VaultResponse[]>("/vaults");
    logEvent("INFO", "vaults_listed", { count: data.length });
    return data;
}

export async function createVault(nameEncrypted: string, nameIv: string): Promise<VaultResponse> {
    const { data } = await api.post<VaultResponse>("/vaults", {
        name_encrypted: nameEncrypted,
        name_iv: nameIv,
    });
    logEvent("INFO", "vault_created", { vault_id: data.id });
    return data;
}

export async function updateVault(vaultId: string, nameEncrypted: string, nameIv: string): Promise<VaultResponse> {
    const { data } = await api.put<VaultResponse>(`/vaults/${vaultId}`, {
        name_encrypted: nameEncrypted,
        name_iv: nameIv,
    });
    logEvent("INFO", "vault_updated", { vault_id: vaultId });
    return data;
}

export async function deleteVault(vaultId: string): Promise<void> {
    await api.delete(`/vaults/${vaultId}`);
    logEvent("INFO", "vault_deleted", { vault_id: vaultId });
}

// --- Entries ---

export async function listEntries(vaultId: string): Promise<EntryResponse[]> {
    const { data } = await api.get<EntryResponse[]>(`/vaults/${vaultId}/entries`);
    logEvent("INFO", "entries_listed", { vault_id: vaultId, count: data.length });
    return data;
}

export async function createEntry(vaultId: string, dataEncrypted: string, dataIv: string): Promise<EntryResponse> {
    const { data } = await api.post<EntryResponse>(`/vaults/${vaultId}/entries`, {
        data_encrypted: dataEncrypted,
        data_iv: dataIv,
    });
    logEvent("INFO", "entry_created", { vault_id: vaultId, entry_id: data.id });
    return data;
}

export async function updateEntry(entryId: string, dataEncrypted: string, dataIv: string): Promise<EntryResponse> {
    const { data } = await api.put<EntryResponse>(`/entries/${entryId}`, {
        data_encrypted: dataEncrypted,
        data_iv: dataIv,
    });
    logEvent("INFO", "entry_updated", { entry_id: entryId });
    return data;
}

export async function deleteEntry(entryId: string): Promise<void> {
    await api.delete(`/entries/${entryId}`);
    logEvent("INFO", "entry_deleted", { entry_id: entryId });
}