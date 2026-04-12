import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVaultStore } from "../stores/vaultStore";
import { logout } from "../api/auth";

export function VaultList() {
    const navigate = useNavigate();
    const { vaults, loadingVaults, fetchVaults, createVault, deleteVault } = useVaultStore();

    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchVaults().catch((err) => {
            console.error("[VaultList] fetch failed:", err);
            setError("Failed to load vaults");
        });
    }, [fetchVaults]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        const trimmed = newName.trim();
        if (!trimmed) return;

        setCreating(true);
        setError(null);
        try {
            await createVault(trimmed);
            setNewName("");
            setShowCreate(false);
        } catch (err) {
            console.error("[VaultList] create failed:", err);
            setError("Failed to create vault");
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(vaultId: string) {
        setError(null);
        try {
            await deleteVault(vaultId);
            setDeleteTarget(null);
        } catch (err) {
            console.error("[VaultList] delete failed:", err);
            setError("Failed to delete vault");
        }
    }

    async function handleLogout() {
        await logout();
        navigate("/login");
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-[#0f1117] via-[#1a1d27] to-violet-900/50">
            {/* Header */}
            <header className="border-b border-[#2e303a] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600/20">
                        <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-semibold text-white">VaultKeeper</h1>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                    Logout
                </button>
            </header>

            {/* Content */}
            <main className="max-w-2xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Your Vaults</h2>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                    >
                        + New Vault
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                {/* Create vault inline form */}
                {showCreate && (
                    <form
                        onSubmit={handleCreate}
                        className="bg-[#1a1d27] border border-violet-500/30 rounded-xl p-4 mb-4 flex gap-3"
                    >
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Vault name"
                            autoFocus
                            className="flex-1 bg-[#0f1117] border border-[#2e303a] rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={creating || !newName.trim()}
                            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                        >
                            {creating ? "Encrypting..." : "Create"}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowCreate(false); setNewName(""); }}
                            className="text-gray-400 hover:text-white text-sm px-3 transition-colors"
                        >
                            Cancel
                        </button>
                    </form>
                )}

                {/* Loading state */}
                {loadingVaults && (
                    <div className="text-center py-12 text-gray-400">
                        Decrypting vaults...
                    </div>
                )}

                {/* Empty state */}
                {!loadingVaults && vaults.length === 0 && (
                    <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1a1d27] border border-[#2e303a] mb-4">
                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <p className="text-gray-400 mb-1">No vaults yet</p>
                        <p className="text-gray-600 text-sm">Create your first vault to start storing passwords</p>
                    </div>
                )}

                {/* Vault list */}
                <div className="space-y-2">
                    {vaults.map((vault) => (
                        <div
                            key={vault.id}
                            className="bg-[#1a1d27] border border-[#2e303a] rounded-xl p-4 flex items-center justify-between hover:border-violet-500/30 transition-colors group"
                        >
                            <button
                                onClick={() => navigate(`/vaults/${vault.id}`)}
                                className="flex-1 text-left"
                            >
                                <span className="text-white font-medium group-hover:text-violet-300 transition-colors">
                                    {vault.name}
                                </span>
                                <span className="block text-xs text-gray-500 mt-0.5">
                                    Updated {new Date(vault.updated_at).toLocaleDateString()}
                                </span>
                            </button>

                            {/* Delete confirmation */}
                            {deleteTarget === vault.id ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-red-400">Delete?</span>
                                    <button
                                        onClick={() => handleDelete(vault.id)}
                                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(null)}
                                        className="text-xs text-gray-400 hover:text-white"
                                    >
                                        No
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setDeleteTarget(vault.id)}
                                    className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}