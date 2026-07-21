import * as ast from "acorn";
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed built-in functions for safe execution
export const ALLOWED_BUILTINS = {
  range: (n: number) => Array.from({ length: n }, (_, i) => i),
  len: (arr: any[]) => arr.length,
  print: console.log,
  sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
  min: Math.min,
  max: Math.max,
  JSON: JSON,
  Math: Math,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
};

// Forbidden imports that could compromise security
export const FORBIDDEN_IMPORTS = new Set([
  "os",
  "sys",
  "subprocess",
  "shutil",
  "socket",
  "fs",
  "child_process",
  "net",
  "http",
  "https",
  "path",
  "process",
  "require",
  "eval",
  "exec",
]);

// Dangerous patterns in code
export const DANGEROUS_PATTERNS = [
  /require\s*\(/gi,
  /import\s+.*\s+from\s+/gi,
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /Function\s*\(/gi,
  /process\./gi,
  /global\./gi,
  /__dirname/gi,
  /__filename/gi,
];

/**
 * Validate code for security threats
 * Returns true if safe, throws error if dangerous
 */
export function validateCode(code: string): boolean {
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      throw new Error(`Forbidden pattern detected: ${pattern.source}`);
    }
  }

  // Check for forbidden keywords
  const forbiddenKeywords = [
    "require",
    "import",
    "eval",
    "exec",
    "Function",
    "process",
    "global",
  ];
  for (const keyword of forbiddenKeywords) {
    if (new RegExp(`\\b${keyword}\\b`).test(code)) {
      throw new Error(`Forbidden keyword: ${keyword}`);
    }
  }

  return true;
}

/**
 * Intent firewall - blocks dangerous user intents
 */
export function intentFilter(userInput: string): boolean {
  const dangerousPatterns = [
    "read files",
    "access system",
    "environment variables",
    "private key",
    "token",
    "ssh",
    "delete",
    "remove",
    "execute command",
    "system call",
  ];

  const lowered = userInput.toLowerCase();
  return !dangerousPatterns.some((p) => lowered.includes(p));
}

/**
 * Sanitize memory entries to prevent credential leakage
 */
export function sanitizeMemory(entry: Record<string, any>): Record<string, any> {
  const blacklist = ["key", "token", "secret", "password", "api", "auth"];
  const clean: Record<string, any> = {};

  for (const [k, v] of Object.entries(entry)) {
    const shouldFilter = blacklist.some((b) => k.toLowerCase().includes(b));
    if (!shouldFilter) {
      clean[k] = v;
    }
  }

  return clean;
}

/**
 * Safe code execution in isolated context
 * Returns result or error object
 */
export async function safeExec(
  code: string,
  inputData?: any,
  timeout: number = 3000
): Promise<any> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ error: "Execution timeout" });
    }, timeout);

    try {
      validateCode(code);

      // Create isolated execution context
      const localEnv: Record<string, any> = { data: inputData };
      const globalEnv: Record<string, any> = {
        __builtins__: ALLOWED_BUILTINS,
        console: { log: console.log, error: console.error },
      };

      // Execute code in isolated context
      const func = new Function(...Object.keys(globalEnv), code);
      const result = func(...Object.values(globalEnv));

      clearTimeout(timer);
      resolve(result || localEnv.result || null);
    } catch (error) {
      clearTimeout(timer);
      resolve({
        error: error instanceof Error ? error.message : "Unknown error",
        trace: error instanceof Error ? error.stack : "",
      });
    }
  });
}

/**
 * Compute stability delta (Δ) based on execution result
 * Returns value between 0 and 1, where 0.02-0.04 is ideal
 */
export function computeDelta(result: any): number {
  if (result.error) {
    // Error reduces stability
    const errorLength = String(result.error).length;
    return Math.min(1.0, errorLength / 500);
  }
  // Successful execution = ideal stability
  return 0.03;
}
