import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useVaultStore } from "../stores/vaultStore";
import { PasswordGenerator } from "../components/PasswordGenerator";
import type { VaultEntry } from "../stores/vaultStore";

const CLIPBOARD_CLEAR_MS = 30_000;
const CIPHER_CHARS = "0123456789abcdef!@#$%^&*<>{}[]|/\\";

function logEvent(level: "INFO" | "WARNING", event: string, extra: Record<string, unknown> = {}) {
    const payload = JSON.stringify({ level, component: "entryDetail", event, ...extra });
    if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

// ---------------------------------------------------------------------------
// Mouse spotlight
// ---------------------------------------------------------------------------

function MouseSpotlight() {
    const posRef = useRef({ x: -1000, y: -1000 });
    const currentRef = useRef({ x: -1000, y: -1000 });
    const divRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        function onMouseMove(e: MouseEvent) {
            posRef.current = { x: e.clientX, y: e.clientY };
        }
        function tick() {
            const c = currentRef.current, t = posRef.current;
            c.x += (t.x - c.x) * 0.06;
            c.y += (t.y - c.y) * 0.06;
            if (divRef.current) {
                divRef.current.style.background = `radial-gradient(600px circle at ${c.x}px ${c.y}px, rgba(139, 92, 246, 0.035), transparent 40%)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        }
        window.addEventListener("mousemove", onMouseMove);
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return <div ref={divRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}

// ---------------------------------------------------------------------------
// Copy button with animated checkmark
// ---------------------------------------------------------------------------

function CopyButton({ value, label }: { value: string; label: string }) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            logEvent("INFO", "clipboard_copy", { field: label });

            setTimeout(async () => {
                try {
                    const current = await navigator.clipboard.readText();
                    if (current === value) {
                        await navigator.clipboard.writeText("");
                        logEvent("INFO", "clipboard_auto_cleared", { field: label });
                    }
                } catch { /* tab may have lost focus */ }
            }, CLIPBOARD_CLEAR_MS);

            setTimeout(() => setCopied(false), 2000);
        } catch {
            logEvent("WARNING", "clipboard_failed", { field: label });
        }
    }

    return (
        <motion.button
            onClick={handleCopy}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-[11px] text-gray-500 hover:text-violet-400 transition-colors px-2 py-1 rounded-md hover:bg-violet-500/5"
        >
            <AnimatePresence mode="wait">
                {copied ? (
                    <motion.span
                        key="check"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="text-green-400"
                    >
                        ✓ Copied
                    </motion.span>
                ) : (
                    <motion.span
                        key="copy"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                    >
                        Copy
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    );
}

// ---------------------------------------------------------------------------
// Password field with GSAP decrypt reveal
// ---------------------------------------------------------------------------

function PasswordField({ value }: { value: string }) {
    const [visible, setVisible] = useState(false);
    const displayRef = useRef<HTMLSpanElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    function handleToggle() {
        if (!visible) {
            // Decrypt reveal animation via GSAP-style character cycling
            setVisible(true);
            const el = displayRef.current;
            if (!el) return;

            const totalFrames = Math.ceil(600 / 25);
            let frame = 0;

            clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                const progress = frame / totalFrames;
                const resolved = Math.floor(progress * value.length);

                el.textContent = value
                    .split("")
                    .map((char, i) => {
                        if (i < resolved) return char;
                        return CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
                    })
                    .join("");

                frame++;
                if (frame > totalFrames) {
                    el.textContent = value;
                    clearInterval(intervalRef.current);
                }
            }, 25);
        } else {
            clearInterval(intervalRef.current);
            setVisible(false);
        }
    }

    useEffect(() => {
        return () => clearInterval(intervalRef.current);
    }, []);

    return (
        <div className="flex items-center gap-2">
            <span
                ref={displayRef}
                className="text-gray-200 text-sm font-mono break-all select-all"
            >
                {visible ? value : "•".repeat(Math.min(value.length, 20))}
            </span>
            <motion.button
                onClick={handleToggle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-[11px] text-gray-500 hover:text-violet-400 transition-colors px-2 py-1 rounded-md hover:bg-violet-500/5 shrink-0"
            >
                {visible ? "Hide" : "Reveal"}
            </motion.button>
            <CopyButton value={value} label="password" />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Entry form (shared for create / edit)
// ---------------------------------------------------------------------------

interface EntryFormData {
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
}

const EMPTY_FORM: EntryFormData = { title: "", username: "", password: "", url: "", notes: "" };

const inputClass =
    "w-full bg-[#0a0c12]/80 border border-[#1e2030] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-300";

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

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}>
                    <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Title *</label>
                    <input type="text" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. GitHub" required autoFocus className={inputClass} />
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wider">URL</label>
                    <input type="text" value={form.url} onChange={(e) => update("url", e.target.value)} placeholder="https://github.com" className={inputClass} />
                </motion.div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                    <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Username *</label>
                    <input type="text" value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="user@example.com" required className={inputClass} />
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                    <label className="flex items-center justify-between text-[11px] text-gray-500 mb-1 uppercase tracking-wider">
                        <span>Password *</span>
                        <button
                            type="button"
                            onClick={() => setShowGenerator((v) => !v)}
                            className="text-violet-400 hover:text-violet-300 transition-colors normal-case tracking-normal"
                        >
                            {showGenerator ? "Hide" : "Generate"}
                        </button>
                    </label>
                    <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="••••••••" required className={inputClass} />
                </motion.div>
            </div>

            <AnimatePresence>
                {showGenerator && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 120 }}
                        className="overflow-hidden"
                    >
                        <PasswordGenerator
                            onUse={(generated) => {
                                update("password", generated);
                                setShowGenerator(false);
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                <label className="block text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Notes</label>
                <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes..." rows={2} className={inputClass + " resize-none"} />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex gap-2 justify-end pt-1"
            >
                <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-white px-4 py-2 transition-colors rounded-lg">
                    Cancel
                </button>
                <motion.button
                    type="submit"
                    disabled={submitting || !form.title.trim() || !form.username.trim() || !form.password.trim()}
                    whileHover={!submitting ? { scale: 1.03 } : {}}
                    whileTap={!submitting ? { scale: 0.97 } : {}}
                    className="relative bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl px-5 py-2 transition-colors overflow-hidden"
                >
                    {submitting && (
                        <motion.div
                            className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                    )}
                    <span className="relative">{submitting ? "Encrypting..." : submitLabel}</span>
                </motion.button>
            </motion.div>
        </form>
    );
}

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const headerVariants: Variants = {
    hidden: { opacity: 0, y: -12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0, 1] } },
};

const staggerContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

const cardVariant: Variants = {
    hidden: { opacity: 0, y: 14, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", damping: 25, stiffness: 120 },
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        x: -20,
        transition: { duration: 0.25 },
    },
};

const expandVariants: Variants = {
    collapsed: { opacity: 0, height: 0 },
    expanded: {
        opacity: 1,
        height: "auto",
        transition: { type: "spring", damping: 25, stiffness: 120, opacity: { delay: 0.05 } },
    },
};

const formSlide: Variants = {
    hidden: { opacity: 0, height: 0, marginBottom: 0 },
    visible: {
        opacity: 1,
        height: "auto",
        marginBottom: 16,
        transition: { type: "spring", damping: 25, stiffness: 120 },
    },
    exit: {
        opacity: 0,
        height: 0,
        marginBottom: 0,
        transition: { duration: 0.2 },
    },
};

// ---------------------------------------------------------------------------
// EntryDetail
// ---------------------------------------------------------------------------

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

    // Vault not found
    if (!vaultId || (!loadingEntries && !vault)) {
        return (
            <div className="min-h-screen bg-[#0a0c12] flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <p className="text-gray-400 mb-4">Vault not found</p>
                    <button onClick={() => navigate("/vaults")} className="text-violet-400 hover:text-violet-300 text-sm transition-colors">
                        ← Back to vaults
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0c12] text-white">
            <MouseSpotlight />

            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/4 rounded-full blur-[150px] pointer-events-none" />

            <div className="fixed inset-0 pointer-events-none opacity-[0.025]" style={{ zIndex: 1 }}>
                <svg width="100%" height="100%">
                    <filter id="grain-entries">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#grain-entries)" />
                </svg>
            </div>

            {/* ─── Header ─── */}
            <motion.header
                variants={headerVariants}
                initial="hidden"
                animate="visible"
                className="relative border-b border-[#1e2030] px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-[#0a0c12]/80"
                style={{ zIndex: 10 }}
            >
                <div className="flex items-center gap-3">
                    <motion.button
                        onClick={() => navigate("/vaults")}
                        whileHover={{ x: -3 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-gray-500 hover:text-white transition-colors p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                        </svg>
                    </motion.button>

                    {/* Logo → Landing */}
                    <Link to="/" className="group relative w-7 h-7 shrink-0">
                        <div className="absolute inset-0 rounded-md border border-violet-500/20 group-hover:border-violet-500/30 transition-colors" style={{ animation: "spin 12s linear infinite" }}>
                            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400 shadow-[0_0_4px_rgba(139,92,246,0.8)]" />
                        </div>
                        <div className="absolute inset-0.5 rounded-sm bg-violet-600/15 flex items-center justify-center">
                            <svg className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </Link>

                    <div>
                        <h1 className="text-sm font-semibold text-white">{vault?.name || "Loading..."}</h1>
                        <p className="text-[11px] text-gray-600">{vaultEntries.length} {vaultEntries.length === 1 ? "entry" : "entries"} · encrypted</p>
                    </div>
                </div>
                <motion.button
                    onClick={() => { setShowCreate(true); setExpandedId(null); setEditingId(null); }}
                    whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)" }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors shadow-lg shadow-violet-600/10"
                >
                    + New Entry
                </motion.button>
            </motion.header>

            {/* ─── Content ─── */}
            <main className="relative max-w-2xl mx-auto px-4 py-6" style={{ zIndex: 2 }}>
                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4 overflow-hidden"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Create form */}
                <AnimatePresence>
                    {showCreate && (
                        <motion.div variants={formSlide} initial="hidden" animate="visible" exit="exit" className="overflow-hidden">
                            <div className="relative bg-[#12141c]/70 backdrop-blur-sm border border-violet-500/20 rounded-xl p-5 overflow-hidden">
                                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/30 to-transparent" />
                                <h3 className="text-sm font-medium text-white mb-3">New Entry</h3>
                                <EntryForm
                                    initial={EMPTY_FORM}
                                    onSubmit={handleCreate}
                                    onCancel={() => setShowCreate(false)}
                                    submitLabel="Create"
                                    submitting={submitting}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Loading */}
                {loadingEntries && (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className="bg-[#12141c]/60 border border-[#1e2030] rounded-xl p-4 flex items-center gap-3"
                            >
                                <div className="w-9 h-9 rounded-lg bg-[#1e2030] animate-pulse" />
                                <div className="space-y-1.5 flex-1">
                                    <div className="h-3 w-28 bg-[#1e2030] rounded animate-pulse" />
                                    <div className="h-2.5 w-36 bg-[#1e2030] rounded animate-pulse" style={{ animationDelay: "0.1s" }} />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loadingEntries && vaultEntries.length === 0 && !showCreate && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", damping: 20, stiffness: 80 }}
                        className="text-center py-20"
                    >
                        <div className="relative inline-flex items-center justify-center w-20 h-20 mb-5">
                            <div className="absolute w-20 h-20 rounded-2xl border border-[#1e2030]" style={{ animation: "spin 15s linear infinite" }}>
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-violet-400/40" />
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-[#12141c] border border-[#1e2030] flex items-center justify-center">
                                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-gray-400 mb-1 text-sm">No entries yet</p>
                        <p className="text-gray-600 text-xs">Add your first credential to this vault</p>
                    </motion.div>
                )}

                {/* Entry list */}
                <motion.div className="space-y-2" initial="hidden" animate="visible" variants={staggerContainer}>
                    <AnimatePresence mode="popLayout">
                        {vaultEntries.map((entry) => (
                            <motion.div
                                key={entry.id}
                                layout
                                variants={cardVariant}
                                exit="exit"
                                className="group relative bg-[#12141c]/60 backdrop-blur-sm border border-[#1e2030] rounded-xl overflow-hidden"
                            >
                                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/0 to-transparent group-hover:via-violet-500/30 transition-all duration-500" />

                                {/* Collapsed row */}
                                <button
                                    onClick={() => toggleExpand(entry.id)}
                                    className="w-full px-4 py-3.5 flex items-center justify-between text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg bg-violet-600/10 border border-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-600/20 transition-colors duration-300">
                                            <span className="text-violet-400 text-sm font-semibold">
                                                {entry.title.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-white text-sm font-medium block truncate">{entry.title}</span>
                                            <span className="text-gray-600 text-[11px] block truncate">{entry.username}</span>
                                        </div>
                                    </div>
                                    <motion.div
                                        animate={{ rotate: expandedId === entry.id ? 180 : 0 }}
                                        transition={{ duration: 0.25 }}
                                    >
                                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </motion.div>
                                </button>

                                {/* Expanded detail */}
                                <AnimatePresence>
                                    {expandedId === entry.id && (
                                        <motion.div
                                            variants={expandVariants}
                                            initial="collapsed"
                                            animate="expanded"
                                            exit="collapsed"
                                            className="overflow-hidden"
                                        >
                                            <div className="border-t border-[#1e2030] px-4 py-4">
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
                                                            <span className="text-[11px] text-gray-500 uppercase tracking-wider">Username</span>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <span className="text-gray-200 text-sm">{entry.username}</span>
                                                                <CopyButton value={entry.username} label="username" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-[11px] text-gray-500 uppercase tracking-wider">Password</span>
                                                            <div className="mt-0.5">
                                                                <PasswordField value={entry.password} />
                                                            </div>
                                                        </div>
                                                        {entry.url && (
                                                            <div>
                                                                <span className="text-[11px] text-gray-500 uppercase tracking-wider">URL</span>
                                                                <a
                                                                    href={entry.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-violet-400 hover:text-violet-300 text-sm block truncate mt-0.5 transition-colors"
                                                                >
                                                                    {entry.url}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {entry.notes && (
                                                            <div>
                                                                <span className="text-[11px] text-gray-500 uppercase tracking-wider">Notes</span>
                                                                <p className="text-gray-300 text-sm whitespace-pre-wrap mt-0.5">{entry.notes}</p>
                                                            </div>
                                                        )}

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-2 pt-3 border-t border-[#1e2030]">
                                                            <motion.button
                                                                onClick={() => setEditingId(entry.id)}
                                                                whileHover={{ scale: 1.03 }}
                                                                whileTap={{ scale: 0.97 }}
                                                                className="text-[11px] text-gray-400 hover:text-violet-400 px-3 py-1.5 rounded-lg hover:bg-violet-500/5 transition-all"
                                                            >
                                                                Edit
                                                            </motion.button>

                                                            <AnimatePresence mode="wait">
                                                                {deleteTarget === entry.id ? (
                                                                    <motion.div
                                                                        key="confirm"
                                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                                        animate={{ opacity: 1, scale: 1 }}
                                                                        exit={{ opacity: 0, scale: 0.9 }}
                                                                        className="flex items-center gap-1.5"
                                                                    >
                                                                        <span className="text-[11px] text-red-400/80">Delete?</span>
                                                                        <button
                                                                            onClick={() => handleDelete(entry.id)}
                                                                            className="text-[11px] text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                                                                        >
                                                                            Yes
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDeleteTarget(null)}
                                                                            className="text-[11px] text-gray-500 hover:text-white px-2 py-1 transition-colors"
                                                                        >
                                                                            No
                                                                        </button>
                                                                    </motion.div>
                                                                ) : (
                                                                    <motion.button
                                                                        key="delete"
                                                                        initial={{ opacity: 0 }}
                                                                        animate={{ opacity: 1 }}
                                                                        exit={{ opacity: 0 }}
                                                                        onClick={() => setDeleteTarget(entry.id)}
                                                                        className="text-[11px] text-gray-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/5 transition-all"
                                                                    >
                                                                        Delete
                                                                    </motion.button>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            </main>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}