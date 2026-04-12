import { useState, useCallback } from "react";

interface GeneratorOptions {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
}

const DEFAULT_OPTIONS: GeneratorOptions = {
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
};

const CHARSETS = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
};

function logEvent(level: "INFO" | "WARNING", event: string, extra: Record<string, unknown> = {}): void {
    const payload = JSON.stringify({ level, component: "passwordGenerator", event, ...extra });
    if (level === "WARNING") console.warn(payload);
    else console.info(payload);
}

/**
 * Generates a cryptographically secure random password.
 * Uses crypto.getRandomValues — NOT Math.random — because
 * Math.random is a PRNG seeded from a predictable source
 * and is trivially reversible given enough output samples.
 */
function generatePassword(options: GeneratorOptions): string {
    let charset = "";
    if (options.uppercase) charset += CHARSETS.uppercase;
    if (options.lowercase) charset += CHARSETS.lowercase;
    if (options.numbers) charset += CHARSETS.numbers;
    if (options.symbols) charset += CHARSETS.symbols;

    if (!charset) return "";

    // Rejection sampling to avoid modulo bias. crypto.getRandomValues
    // returns uniform bytes [0, 255]. If charset.length doesn't divide
    // 256 evenly, naive index = byte % length introduces bias toward
    // lower indices. We reject values >= largest multiple of length.
    const maxValid = 256 - (256 % charset.length);
    const result: string[] = [];
    const buffer = new Uint8Array(options.length * 2); // oversized to reduce re-rolls

    let bufferIndex = 0;
    crypto.getRandomValues(buffer);

    while (result.length < options.length) {
        if (bufferIndex >= buffer.length) {
            // Exhausted buffer without filling result — refill
            crypto.getRandomValues(buffer);
            bufferIndex = 0;
        }

        const byte = buffer[bufferIndex++];
        if (byte < maxValid) {
            result.push(charset[byte % charset.length]);
        }
        // else: reject and try next byte
    }

    logEvent("INFO", "password_generated", {
        length: options.length,
        charset_size: charset.length,
    });

    return result.join("");
}

/**
 * Standalone password generator with configurable options.
 * Designed to be used inside EntryDetail forms or as a
 * standalone utility.
 *
 * onUse callback allows the parent to receive the generated
 * password (e.g. to fill a form field).
 */
export function PasswordGenerator({ onUse }: { onUse?: (password: string) => void }) {
    const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_OPTIONS);
    const [password, setPassword] = useState(() => generatePassword(DEFAULT_OPTIONS));
    const [copied, setCopied] = useState(false);

    const hasAnyCharset = options.uppercase || options.lowercase || options.numbers || options.symbols;

    const regenerate = useCallback(() => {
        if (!hasAnyCharset) return;
        setPassword(generatePassword(options));
        setCopied(false);
    }, [options, hasAnyCharset]);

    function toggleOption(key: keyof Omit<GeneratorOptions, "length">) {
        setOptions((prev) => {
            const updated = { ...prev, [key]: !prev[key] };

            // Prevent disabling all charsets — at least one must remain
            const anyEnabled = updated.uppercase || updated.lowercase || updated.numbers || updated.symbols;
            if (!anyEnabled) return prev;

            const newPassword = generatePassword(updated);
            setPassword(newPassword);
            setCopied(false);
            return updated;
        });
    }

    function setLength(length: number) {
        const clamped = Math.max(8, Math.min(128, length));
        setOptions((prev) => {
            const updated = { ...prev, length: clamped };
            setPassword(generatePassword(updated));
            setCopied(false);
            return updated;
        });
    }

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(password);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);

            // Auto-clear clipboard after 30s
            const snapshot = password;
            setTimeout(async () => {
                try {
                    const current = await navigator.clipboard.readText();
                    if (current === snapshot) {
                        await navigator.clipboard.writeText("");
                    }
                } catch {
                    // Tab may have lost focus
                }
            }, 30_000);
        } catch {
            logEvent("WARNING", "clipboard_failed");
        }
    }

    const toggleClass = (active: boolean) =>
        `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            active
                ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                : "bg-[#0f1117] text-gray-500 border border-[#2e303a] hover:border-gray-500"
        }`;

    return (
        <div className="bg-[#1a1d27] border border-[#2e303a] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Password Generator</h3>
                <button
                    onClick={regenerate}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                    ↻ Regenerate
                </button>
            </div>

            {/* Generated password display */}
            <div className="bg-[#0f1117] border border-[#2e303a] rounded-lg px-4 py-3 flex items-center gap-3">
                <code className="text-sm text-green-400 font-mono flex-1 break-all select-all">
                    {password}
                </code>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleCopy}
                        className="text-xs text-gray-500 hover:text-violet-400 transition-colors"
                    >
                        {copied ? "Copied!" : "Copy"}
                    </button>
                    {onUse && (
                        <button
                            onClick={() => onUse(password)}
                            className="text-xs bg-violet-600 hover:bg-violet-500 text-white rounded px-2 py-1 transition-colors"
                        >
                            Use
                        </button>
                    )}
                </div>
            </div>

            {/* Length slider */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Length</label>
                    <span className="text-xs text-gray-400 font-mono">{options.length}</span>
                </div>
                <input
                    type="range"
                    min={8}
                    max={128}
                    value={options.length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600">
                    <span>8</span>
                    <span>128</span>
                </div>
            </div>

            {/* Character type toggles */}
            <div className="flex flex-wrap gap-2">
                <button onClick={() => toggleOption("uppercase")} className={toggleClass(options.uppercase)}>
                    A-Z
                </button>
                <button onClick={() => toggleOption("lowercase")} className={toggleClass(options.lowercase)}>
                    a-z
                </button>
                <button onClick={() => toggleOption("numbers")} className={toggleClass(options.numbers)}>
                    0-9
                </button>
                <button onClick={() => toggleOption("symbols")} className={toggleClass(options.symbols)}>
                    !@#$
                </button>
            </div>
        </div>
    );
}