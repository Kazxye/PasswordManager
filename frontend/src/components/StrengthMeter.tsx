import { useMemo } from "react";

type Strength = "weak" | "fair" | "good" | "strong";

interface StrengthResult {
    score: Strength;
    entropy: number;
    feedback: string;
}

const STRENGTH_CONFIG: Record<Strength, { color: string; bg: string; width: string; label: string }> = {
    weak:   { color: "text-red-400",    bg: "bg-red-400",    width: "w-1/4",  label: "Weak" },
    fair:   { color: "text-yellow-400", bg: "bg-yellow-400", width: "w-2/4",  label: "Fair" },
    good:   { color: "text-blue-400",   bg: "bg-blue-400",   width: "w-3/4",  label: "Good" },
    strong: { color: "text-green-400",  bg: "bg-green-400",  width: "w-full", label: "Strong" },
};

// Common passwords and patterns that drastically reduce effective entropy.
// This is NOT a substitute for zxcvbn (Phase 6), but catches the worst offenders.
const COMMON_PATTERNS = [
    /^(.)\1+$/,                    // all same char: "aaaaaaa"
    /^(012|123|234|345|456|567|678|789)+/,  // sequential digits
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+/i,
    /^(qwerty|asdf|zxcv)/i,        // keyboard walks
    /^(password|letmein|welcome|admin|master|login)/i,
];

/**
 * Estimates password strength based on Shannon entropy with
 * penalty adjustments for detectable patterns.
 *
 * Entropy = length × log2(charset_size)
 *
 * This gives a theoretical upper bound. Real entropy is lower
 * if the password contains patterns, dictionary words, or
 * personal info — those deductions require zxcvbn (Phase 6).
 * For now, we apply coarse penalties for obvious patterns.
 */
function analyzeStrength(password: string): StrengthResult {
    if (!password) {
        return { score: "weak", entropy: 0, feedback: "Enter a password" };
    }

    // Calculate charset size from actual character classes present
    let charsetSize = 0;
    if (/[a-z]/.test(password)) charsetSize += 26;
    if (/[A-Z]/.test(password)) charsetSize += 26;
    if (/[0-9]/.test(password)) charsetSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

    // Shannon entropy upper bound
    let entropy = password.length * Math.log2(charsetSize || 1);

    // Penalty: repeated characters reduce effective keyspace
    const uniqueRatio = new Set(password).size / password.length;
    if (uniqueRatio < 0.5) {
        entropy *= 0.6;
    }

    // Penalty: common patterns
    const hasCommonPattern = COMMON_PATTERNS.some((p) => p.test(password));
    if (hasCommonPattern) {
        entropy *= 0.4;
    }

    // Classify
    let score: Strength;
    let feedback: string;

    if (entropy < 36) {
        score = "weak";
        feedback = "Easily cracked — add length and variety";
    } else if (entropy < 60) {
        score = "fair";
        feedback = "Resists casual attacks — consider more length";
    } else if (entropy < 80) {
        score = "good";
        feedback = "Solid against most attacks";
    } else {
        score = "strong";
        feedback = "Excellent — resilient to brute force";
    }

    // Override: short passwords are always weak regardless of charset
    if (password.length < 8) {
        score = "weak";
        feedback = "Too short — use at least 12 characters";
    }

    return { score, entropy: Math.round(entropy), feedback };
}

/**
 * Visual password strength indicator. Designed to be placed
 * below a password input field. Shows a colored bar, label,
 * and entropy estimate.
 *
 * Does NOT store or log the password — only computes derived
 * metrics that cannot reconstruct the original.
 */
export function StrengthMeter({ password }: { password: string }) {
    const result = useMemo(() => analyzeStrength(password), [password]);
    const config = STRENGTH_CONFIG[result.score];

    if (!password) return null;

    return (
        <div className="space-y-1.5 mt-2">
            {/* Bar */}
            <div className="h-1 bg-[#2e303a] rounded-full overflow-hidden">
                <div
                    className={`h-full ${config.bg} rounded-full transition-all duration-300`}
                    style={{ width: config.width.replace("w-", "").replace("1/4", "25%").replace("2/4", "50%").replace("3/4", "75%").replace("full", "100%") }}
                />
            </div>

            {/* Label and entropy */}
            <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${config.color}`}>
                    {config.label}
                </span>
                <span className="text-[10px] text-gray-600">
                    ~{result.entropy} bits entropy
                </span>
            </div>

            {/* Feedback */}
            <p className="text-[11px] text-gray-500">{result.feedback}</p>
        </div>
    );
}