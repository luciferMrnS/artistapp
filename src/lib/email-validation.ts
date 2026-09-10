/**
 * Email Validation Utilities
 * Validates email format and domain existence via MX record lookup
 */

import { validate as validateEmail } from "email-validator";
import dns from "dns/promises";

/**
 * Validate email format
 * Checks RFC 5322 compliance
 */
export function isValidEmailFormat(email: string): boolean {
  return validateEmail(email);
}

/**
 * Check if email domain can receive mail.
 *
 * Strategy:
 *  1. Prefer MX records.
 *  2. Fall back to A/AAAA records (RFC 5321 "implicit MX" — domains without
 *     MX records may still receive mail addressed to their A/AAAA host).
 *  3. Fail OPEN on transient DNS infrastructure errors (ESERVFAIL, timeouts)
 *     so resolver flakiness never blocks legitimate signups. A domain that
 *     genuinely does not exist returns ENOTFOUND, which is NOT transient
 *     and correctly results in rejection.
 */
export async function hasMXRecords(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;

  let sawTransientFailure = false;

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) return true;
  } catch (error) {
    if (isTransientDnsError(error)) sawTransientFailure = true;
  }

  // No (or unreadable) MX records — check implicit MX via A/AAAA
  for (const resolve of [dns.resolve4.bind(dns), dns.resolve6.bind(dns)]) {
    try {
      const addresses = await resolve(domain);
      if (addresses && addresses.length > 0) return true;
    } catch (error) {
      if (isTransientDnsError(error)) sawTransientFailure = true;
    }
  }

  if (sawTransientFailure) {
    console.warn(
      `DNS lookup for "${domain}" failed transiently — accepting email to avoid false signup rejection`
    );
    return true;
  }

  return false;
}

/**
 * DNS error codes indicating a resolver/infrastructure problem,
 * as opposed to a definitive "domain does not exist" answer (ENOTFOUND).
 */
const TRANSIENT_DNS_CODES = new Set([
  "ESERVFAIL",
  "ETIMEOUT",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ESOCKETTIMEDOUT",
  "EAI_AGAIN",
]);

function isTransientDnsError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return typeof code === "string" && TRANSIENT_DNS_CODES.has(code);
}

/**
 * Complete email validation
 * Checks format AND domain existence
 */
export async function isValidEmail(email: string): Promise<{ valid: boolean; error?: string }> {
  // Check format
  if (!isValidEmailFormat(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  // Check domain has mail servers
  const hasMX = await hasMXRecords(email);
  if (!hasMX) {
    return { valid: false, error: "Email domain does not accept mail" };
  }

  return { valid: true };
}
