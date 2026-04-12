import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVaultStore } from "../stores/vaultStore";
import { PasswordGenerator } from "../components/PasswordGenerator";
import type { VaultEntry } from "../stores/vaultStore";

// Clipboard auto-clear timeout. 30s is the standard in password
// managers — long enough to paste, short enough to limit exposure
// if the user forgets.
const CLIPBOARD_CLEAR_MS = 30_000;

function logEvent(level: "INFO" | "WARNING", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "entryDetail", event, ...extra });
    if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

// --- Subcomponents ---

function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            logEvent("INFO", "clipboard_copy", { field: label });

            // Auto-clear clipboard after timeout to reduce exposure
            setTimeout(async () => {
                try {
                    const current = await navigator.clipboard.readText();
                    if (current === value) {
                        await navigator.clipboard.writeText("");
                        logEvent("INFO", "clipboard_auto_cleared", { field: label });
                    }
                } catch {
                    // Clipboard read may fail if tab lost focus — acceptable
                }
            }, CLIPBOARD_CLEAR_MS);

            setTimeout(() => setCopied(false), 2000);
        } catch {
            logEvent("WARNING", "clipboard_failed", { field: label });
        }
    }

    return (
        <button
            onClick={handleCopy}
            className="text-xs text-gray-500 hover:text-violet-400 transition-colors"
            title={`Copy ${label}`}
        >
            {copied ? "Copied!" : "Copy"}
        </button>
    );
}

function PasswordField({ value }: { value: string }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="flex items-center gap-2">
            <span className="text-gray-200 text-sm font-mono break-all">
                {visible ? value : "•".repeat(Math.min(value.length, 24))}
            </span>
            <button
                onClick={() => setVisible((v) => !v)}
                className="text-xs text-gray-500 hover:text-violet-400 transition-colors shrink-0"
            >
                {visible ? "Hide" : "Show"}
            </button>
            <CopyButton value={value} label="password" />
        </div>
    );
}

// --- Entry Form (shared for create and edit) ---

interface EntryFormData {
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
}

const EMPTY_FORM: EntryFormData = { title: "", username: "", password: "", url: "", notes: "" };

function EntryForm({
                       initial,
                       onSubmit,
                       onCancel,
                       submitLabel,
                       submitting,
                   }: {
    initial: EntryFormData;
    onSubmit: (data: EntryFormData) => void;
    onCancel: () => void;
    submitLabel: string;
    submitting: boolean;
}) {
    const [form, setForm] = useState<EntryFormData>(initial);
    const [showGenerator, setShowGenerator] = useState(false);

    function update(field: keyof EntryFormData, value: string) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.title.trim() || !form.username.trim() || !form.password.trim()) return;
        onSubmit(form);
    }

    const inputClass =
        "w-full bg-[#0f1117] border border-[#2e303a] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Title *</label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) => update("title", e.target.value)}
                        placeholder="e.g. GitHub"
                        required
                        autoFocus
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">URL</label>
                    <input
                        type="text"
                        value={form.url}
                        onChange={(e) => update("url", e.target.value)}
                        placeholder="https://github.com"
                        className={inputClass}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Username *</label>
                    <input
                        type="text"
                        value={form.username}
                        onChange={(e) => update("username", e.target.value)}
                        placeholder="user@example.com"
                        required
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Password *</span>
                        <button
                            type="button"
                            onClick={() => setShowGenerator((v) => !v)}
                            className="text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            {showGenerator ? "Hide generator" : "Generate"}
                        </button>
                    </label>
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => update("password", e.target.value)}
                        placeholder="••••••••"
                        required
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Password generator — toggled inline */}
            {showGenerator && (
                <PasswordGenerator
                    onUse={(generated) => {
                        update("password", generated);
                        setShowGenerator(false);
                    }}
                />
            )}

            <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Optional notes..."
                    rows={2}
                    className={inputClass + " resize-none"}
                />
            </div>
            <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-sm text-gray-400 hover:text-white px-3 py-1.5 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={submitting || !form.title.trim() || !form.username.trim() || !form.password.trim()}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-1.5 transition-colors"
                >
                    {submitting ? "Encrypting..." : submitLabel}
                </button>
            </div>
        </form>
    );
}

// --- Main Page ---

export function EntryDetail() {
    const { vaultId } = useParams<{ vaultId: string }>();
    const navigate = useNavigate();

    const vaults = useVaultStore((s) => s.vaults);
    const entries = useVaultStore((s) => s.entries);
    const loadingEntries = useVaultStore((s) => s.loadingEntries);
    const { fetchEntries, createEntry, updateEntry, deleteEntry } = useVaultStore();

    const vault = vaults.find((v) => v.id === vaultId);
    const vaultEntries = vaultId ? entries[vaultId] || [] : [];

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!vaultId) return;
        fetchEntries(vaultId).catch((err) => {
            console.error("[EntryDetail] fetch failed:", err);
            setError("Failed to load entries");
        });
    }, [vaultId, fetchEntries]);

    const handleCreate = useCallback(
        async (data: EntryFormData) => {
            if (!vaultId) return;
            setSubmitting(true);
            setError(null);
            try {
                await createEntry(vaultId, {
                    title: data.title.trim(),
                    username: data.username.trim(),
                    password: data.password,
                    url: data.url.trim() || undefined,
                    notes: data.notes.trim() || undefined,
                });
                setShowCreate(false);
            } catch (err) {
                console.error("[EntryDetail] create failed:", err);
                setError("Failed to create entry");
            } finally {
                setSubmitting(false);
            }
        },
        [vaultId, createEntry]
    );

    const handleUpdate = useCallback(
        async (entryId: string, data: EntryFormData) => {
            if (!vaultId) return;
            setSubmitting(true);
            setError(null);
            try {
                await updateEntry(vaultId, entryId, {
                    title: data.title.trim(),
                    username: data.username.trim(),
                    password: data.password,
                    url: data.url.trim() || undefined,
                    notes: data.notes.trim() || undefined,
                });
                setEditingId(null);
            } catch (err) {
                console.error("[EntryDetail] update failed:", err);
                setError("Failed to update entry");
            } finally {
                setSubmitting(false);
            }
        },
        [vaultId, updateEntry]
    );

    const handleDelete = useCallback(
        async (entryId: string) => {
            if (!vaultId) return;
            setError(null);
            try {
                await deleteEntry(vaultId, entryId);
                setDeleteTarget(null);
                // Collapse if the deleted entry was expanded
                if (expandedId === entryId) setExpandedId(null);
            } catch (err) {
                console.error("[EntryDetail] delete failed:", err);
                setError("Failed to delete entry");
            }
        },
        [vaultId, deleteEntry, expandedId]
    );

    function toggleExpand(entryId: string) {
        setExpandedId((prev) => (prev === entryId ? null : entryId));
        setEditingId(null);
    }

    function entryToForm(entry: VaultEntry): EntryFormData {
        return {
            title: entry.title,
            username: entry.username,
            password: entry.password,
            url: entry.url || "",
            notes: entry.notes || "",
        };
    }

    // Redirect if vault doesn't exist (deleted, or bad URL)
    if (!vaultId || (!loadingEntries && !vault)) {
        return (
            <div className="min-h-screen bg-linear-to-b from-[#0f1117] via-[#1a1d27] to-violet-900/50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-400 mb-4">Vault not found</p>
                    <button
                        onClick={() => navigate("/vaults")}
                        className="text-violet-400 hover:text-violet-300 text-sm"
                    >
                        ← Back to vaults
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-[#0f1117] via-[#1a1d27] to-violet-900/50">
            {/* Header */}
            <header className="border-b border-[#2e303a] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/vaults")}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-lg font-semibold text-white">{vault?.name || "Loading..."}</h1>
                        <p className="text-xs text-gray-500">{vaultEntries.length} entries</p>
                    </div>
                </div>
                <button
                    onClick={() => { setShowCreate(true); setExpandedId(null); setEditingId(null); }}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                    + New Entry
                </button>
            </header>

            {/* Content */}
            <main className="max-w-2xl mx-auto px-4 py-6">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                        {error}
                    </div>
                )}

                {/* Create form */}
                {showCreate && (
                    <div className="bg-[#1a1d27] border border-violet-500/30 rounded-xl p-5 mb-4">
                        <h3 className="text-sm font-medium text-white mb-3">New Entry</h3>
                        <EntryForm
                            initial={EMPTY_FORM}
                            onSubmit={handleCreate}
                            onCancel={() => setShowCreate(false)}
                            submitLabel="Create"
                            submitting={submitting}
                        />
                    </div>
                )}

                {/* Loading */}
                {loadingEntries && (
                    <div className="text-center py-12 text-gray-400">
                        Decrypting entries...
                    </div>
                )}

                {/* Empty state */}
                {!loadingEntries && vaultEntries.length === 0 && !showCreate && (
                    <div className="text-center py-16">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1a1d27] border border-[#2e303a] mb-4">
                            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <p className="text-gray-400 mb-1">No entries yet</p>
                        <p className="text-gray-600 text-sm">Add your first credential to this vault</p>
                    </div>
                )}

                {/* Entry list */}
                <div className="space-y-2">
                    {vaultEntries.map((entry) => (
                        <div
                            key={entry.id}
                            className="bg-[#1a1d27] border border-[#2e303a] rounded-xl overflow-hidden hover:border-violet-500/20 transition-colors"
                        >
                            {/* Collapsed row */}
                            <button
                                onClick={() => toggleExpand(entry.id)}
                                className="w-full px-4 py-3 flex items-center justify-between text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center shrink-0">
                                        <span className="text-violet-400 text-sm font-medium">
                                            {entry.title.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-white text-sm font-medium block truncate">
                                            {entry.title}
                                        </span>
                                        <span className="text-gray-500 text-xs block truncate">
                                            {entry.username}
                                        </span>
                                    </div>
                                </div>
                                <svg
                                    className={`w-4 h-4 text-gray-500 transition-transform ${expandedId === entry.id ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Expanded detail */}
                            {expandedId === entry.id && (
                                <div className="border-t border-[#2e303a] px-4 py-4">
                                    {editingId === entry.id ? (
                                        <EntryForm
                                            initial={entryToForm(entry)}
                                            onSubmit={(data) => handleUpdate(entry.id, data)}
                                            onCancel={() => setEditingId(null)}
                                            submitLabel="Save"
                                            submitting={submitting}
                                        />
                                    ) : (
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-xs text-gray-500">Username</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-200 text-sm">{entry.username}</span>
                                                    <CopyButton value={entry.username} label="username" />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">Password</span>
                                                <PasswordField value={entry.password} />
                                            </div>
                                            {entry.url && (
                                                <div>
                                                    <span className="text-xs text-gray-500">URL</span>
                                                    <a
                                                        href={entry.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-violet-400 hover:text-violet-300 text-sm block truncate"
                                                    >
                                                        {entry.url}
                                                    </a>
                                                </div>
                                            )}
                                            {entry.notes && (
                                                <div>
                                                    <span className="text-xs text-gray-500">Notes</span>
                                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{entry.notes}</p>
                                                </div>
                                            )}

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-3 pt-2 border-t border-[#2e303a]">
                                                <button
                                                    onClick={() => setEditingId(entry.id)}
                                                    className="text-xs text-gray-400 hover:text-violet-400 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                {deleteTarget === entry.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-red-400">Confirm delete?</span>
                                                        <button
                                                            onClick={() => handleDelete(entry.id)}
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
                                                        onClick={() => setDeleteTarget(entry.id)}
                                                        className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}