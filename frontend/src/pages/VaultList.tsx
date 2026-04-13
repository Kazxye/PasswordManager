import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import gsap from "gsap";
import { useVaultStore } from "../stores/vaultStore";
import { logout } from "../api/auth";

// ---------------------------------------------------------------------------
// Framer Motion variants
// ---------------------------------------------------------------------------

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.25, 0.1, 0, 1] },
    },
};

const staggerContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const cardVariant: Variants = {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", damping: 25, stiffness: 120 },
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        x: -30,
        transition: { duration: 0.3, ease: "easeInOut" },
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
        transition: { duration: 0.25, ease: "easeInOut" },
    },
};

// ---------------------------------------------------------------------------
// Mouse spotlight (shared pattern)
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
// Animated vault count (GSAP counter)
// ---------------------------------------------------------------------------

function VaultCount({ count }: { count: number }) {
    const ref = useRef<HTMLSpanElement>(null);
    const prevCount = useRef(0);

    useEffect(() => {
        if (!ref.current) return;
        const obj = { val: prevCount.current };
        gsap.to(obj, {
            val: count,
            duration: 0.8,
            ease: "power2.out",
            onUpdate: () => {
                if (ref.current) ref.current.textContent = String(Math.round(obj.val));
            },
        });
        prevCount.current = count;
    }, [count]);

    return <span ref={ref}>{count}</span>;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
    return (
        <div className="bg-[#12141c]/60 border border-[#1e2030] rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#1e2030] animate-pulse" />
            <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-[#1e2030] rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-[#1e2030] rounded animate-pulse" style={{ animationDelay: "0.1s" }} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// VaultList
// ---------------------------------------------------------------------------

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
        <div className="min-h-screen bg-[#0a0c12] text-white">
            <MouseSpotlight />

            {/* Ambient glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/4 rounded-full blur-[150px] pointer-events-none" />

            {/* Film grain */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.025]" style={{ zIndex: 1 }}>
                <svg width="100%" height="100%">
                    <filter id="grain-vaults">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#grain-vaults)" />
                </svg>
            </div>

            {/* ─── Header ─── */}
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0, 1] }}
                className="relative border-b border-[#1e2030] px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-[#0a0c12]/80"
                style={{ zIndex: 10 }}
            >
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="relative w-8 h-8">
                        <div className="absolute inset-0 rounded-lg border border-violet-500/20 group-hover:border-violet-500/30 transition-colors" style={{ animation: "spin 12s linear infinite" }}>
                            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-400 shadow-[0_0_4px_rgba(139,92,246,0.8)]" />
                        </div>
                        <div className="absolute inset-1 rounded-md bg-violet-600/15 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                    <span className="text-sm font-semibold text-white tracking-tight group-hover:text-violet-300 transition-colors">VaultKeeper</span>
                </Link>
                <motion.button
                    onClick={handleLogout}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="text-xs text-gray-500 hover:text-gray-300 border border-[#1e2030] hover:border-[#2e303a] rounded-lg px-3 py-1.5 transition-colors"
                >
                    Sign out
                </motion.button>
            </motion.header>

            {/* ─── Content ─── */}
            <main className="relative max-w-2xl mx-auto px-4 py-8" style={{ zIndex: 2 }}>
                {/* Title row */}
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="flex items-center justify-between mb-6"
                >
                    <div>
                        <h2 className="text-xl font-semibold text-white">Your Vaults</h2>
                        <p className="text-xs text-gray-600 mt-0.5">
                            <VaultCount count={vaults.length} /> {vaults.length === 1 ? "vault" : "vaults"} · end-to-end encrypted
                        </p>
                    </div>
                    <motion.button
                        onClick={() => setShowCreate(true)}
                        whileHover={{ scale: 1.04, boxShadow: "0 0 20px rgba(139, 92, 246, 0.2)" }}
                        whileTap={{ scale: 0.97 }}
                        className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors shadow-lg shadow-violet-600/10"
                    >
                        + New Vault
                    </motion.button>
                </motion.div>

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4 overflow-hidden"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Create form */}
                <AnimatePresence>
                    {showCreate && (
                        <motion.div
                            variants={formSlide}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="overflow-hidden"
                        >
                            <form
                                onSubmit={handleCreate}
                                className="relative bg-[#12141c]/70 backdrop-blur-sm border border-violet-500/20 rounded-xl p-4 flex gap-3 overflow-hidden"
                            >
                                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/30 to-transparent" />
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Vault name"
                                    autoFocus
                                    className="flex-1 bg-[#0a0c12]/80 border border-[#1e2030] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all duration-300"
                                />
                                <motion.button
                                    type="submit"
                                    disabled={creating || !newName.trim()}
                                    whileHover={!creating ? { scale: 1.03 } : {}}
                                    whileTap={!creating ? { scale: 0.97 } : {}}
                                    className="relative bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors overflow-hidden"
                                >
                                    {creating && (
                                        <motion.div
                                            className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                                            animate={{ x: ["-100%", "200%"] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        />
                                    )}
                                    <span className="relative">{creating ? "Encrypting..." : "Create"}</span>
                                </motion.button>
                                <button
                                    type="button"
                                    onClick={() => { setShowCreate(false); setNewName(""); }}
                                    className="text-gray-500 hover:text-white text-sm px-2 transition-colors"
                                >
                                    ✕
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Loading */}
                {loadingVaults && (
                    <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                            >
                                <SkeletonCard />
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {!loadingVaults && vaults.length === 0 && (
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-gray-400 mb-1 text-sm">No vaults yet</p>
                        <p className="text-gray-600 text-xs">Create your first vault to start storing passwords</p>
                    </motion.div>
                )}

                {/* Vault list */}
                <motion.div
                    className="space-y-2"
                    initial="hidden"
                    animate="visible"
                    variants={staggerContainer}
                >
                    <AnimatePresence mode="popLayout">
                        {vaults.map((vault) => (
                            <motion.div
                                key={vault.id}
                                layout
                                variants={cardVariant}
                                exit="exit"
                                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                                className="group relative bg-[#12141c]/60 backdrop-blur-sm border border-[#1e2030] rounded-xl overflow-hidden cursor-default"
                            >
                                {/* Hover glow edge */}
                                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/0 to-transparent group-hover:via-violet-500/40 transition-all duration-500" />

                                <div className="p-4 flex items-center justify-between">
                                    <button
                                        onClick={() => navigate(`/vaults/${vault.id}`)}
                                        className="flex items-center gap-3.5 flex-1 text-left"
                                    >
                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-600/20 transition-colors duration-300">
                                            <span className="text-violet-400 text-sm font-semibold">
                                                {vault.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-white text-sm font-medium block truncate group-hover:text-violet-300 transition-colors duration-200">
                                                {vault.name}
                                            </span>
                                            <span className="text-[11px] text-gray-600 block mt-0.5">
                                                Updated {new Date(vault.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Delete */}
                                    <AnimatePresence mode="wait">
                                        {deleteTarget === vault.id ? (
                                            <motion.div
                                                key="confirm"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{ duration: 0.15 }}
                                                className="flex items-center gap-2"
                                            >
                                                <span className="text-[11px] text-red-400/80">Delete?</span>
                                                <button
                                                    onClick={() => handleDelete(vault.id)}
                                                    className="text-[11px] text-red-400 hover:text-red-300 font-medium px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 transition-colors"
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(null)}
                                                    className="text-[11px] text-gray-500 hover:text-white px-1.5 py-0.5 transition-colors"
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
                                                onClick={() => setDeleteTarget(vault.id)}
                                                className="text-gray-700 hover:text-red-400 transition-all duration-200 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/5"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
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