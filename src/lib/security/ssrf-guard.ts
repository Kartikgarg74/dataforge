import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of validating a connection target against SSRF rules. */
export interface ValidationResult {
  /** Whether the connection target is considered safe. */
  safe: boolean;
  /** Human-readable explanation when the target is blocked. */
  reason?: string;
}

/** A CIDR block used for IP range matching. */
interface CidrBlock {
  /** Base address as a BigInt. */
  base: bigint;
  /** Bitmask derived from the prefix length. */
  mask: bigint;
  /** Original CIDR notation (for logging / error messages). */
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Well-known cloud metadata endpoint used by AWS, GCP, Azure, and others.
 * Connections to this IP are always blocked regardless of allowlists.
 */
const METADATA_IP = '169.254.169.254';

/**
 * IPv4 CIDR ranges that are considered private or otherwise dangerous.
 *
 * - 127.0.0.0/8     – Loopback
 * - 10.0.0.0/8      – RFC 1918 private
 * - 172.16.0.0/12   – RFC 1918 private
 * - 192.168.0.0/16  – RFC 1918 private
 * - 169.254.0.0/16  – Link-local (includes metadata endpoint)
 * - 0.0.0.0/8       – "This" network
 */
const BLOCKED_IPV4_CIDRS: readonly string[] = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '0.0.0.0/8',
] as const;

/**
 * IPv6 CIDR ranges that are considered private or otherwise dangerous.
 *
 * - ::1/128      – Loopback
 * - fc00::/7     – Unique local addresses
 * - fe80::/10    – Link-local
 * - ::ffff:0:0/96 – IPv4-mapped IPv6 addresses (checked separately via mapped IPv4)
 */
const BLOCKED_IPV6_CIDRS: readonly string[] = [
  '::1/128',
  'fc00::/7',
  'fe80::/10',
  '::ffff:0:0/96',
] as const;

// ---------------------------------------------------------------------------
// IP Parsing Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a dotted-quad IPv4 address into a 32-bit BigInt.
 * Returns `null` if the string is not a valid IPv4 address.
 */
function parseIPv4(ip: string): bigint | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let result = 0n;
  for (const part of parts) {
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    result = (result << 8n) | BigInt(num);
  }
  return result;
}

/**
 * Expand a potentially abbreviated IPv6 address to its full 8-group form,
 * then parse it into a 128-bit BigInt.  Handles `::` expansion and
 * IPv4-mapped addresses (e.g. `::ffff:192.168.1.1`).
 *
 * Returns `null` if the string is not a valid IPv6 address.
 */
function parseIPv6(ip: string): bigint | null {
  // Handle IPv4-mapped IPv6 (e.g. ::ffff:10.0.0.1)
  const v4Suffix = ip.match(/:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4Suffix) {
    const v4 = parseIPv4(v4Suffix[1]);
    if (v4 === null) return null;
    const prefix = ip.slice(0, ip.lastIndexOf(':' + v4Suffix[1]));
    const prefixBig = parseIPv6Pure(prefix.endsWith(':') ? prefix + '0' : prefix);
    if (prefixBig === null) return null;
    return (prefixBig << 32n) | v4;
  }

  return parseIPv6Pure(ip);
}

/**
 * Parse a pure hex IPv6 address (no embedded IPv4) into a 128-bit BigInt.
 */
function parseIPv6Pure(ip: string): bigint | null {
  let fullIp = ip;
  if (fullIp.includes('::')) {
    const sides = fullIp.split('::');
    if (sides.length > 2) return null;

    const left = sides[0] ? sides[0].split(':') : [];
    const right = sides[1] ? sides[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;

    const middle = Array(missing).fill('0');
    fullIp = [...left, ...middle, ...right].join(':');
  }

  const groups = fullIp.split(':');
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    result = (result << 16n) | BigInt(parseInt(group, 16));
  }
  return result;
}

/**
 * Parse a CIDR notation string into a {@link CidrBlock}.
 * Supports both IPv4 (`10.0.0.0/8`) and IPv6 (`fc00::/7`) notation.
 */
function parseCidr(cidr: string): CidrBlock | null {
  const [addr, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);

  // Try IPv4 first
  const v4 = parseIPv4(addr);
  if (v4 !== null) {
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
    const mask = prefix === 0 ? 0n : ((1n << 32n) - 1n) << BigInt(32 - prefix);
    return { base: v4 & mask, mask, label: cidr };
  }

  // Try IPv6
  const v6 = parseIPv6(addr);
  if (v6 !== null) {
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 128) return null;
    const mask = prefix === 0 ? 0n : ((1n << 128n) - 1n) << BigInt(128 - prefix);
    return { base: v6 & mask, mask, label: cidr };
  }

  return null;
}

// Pre-parsed blocked ranges (computed once at module load)
const blockedIPv4Ranges: CidrBlock[] = BLOCKED_IPV4_CIDRS
  .map(parseCidr)
  .filter((b): b is CidrBlock => b !== null);

const blockedIPv6Ranges: CidrBlock[] = BLOCKED_IPV6_CIDRS
  .map(parseCidr)
  .filter((b): b is CidrBlock => b !== null);

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether an IP address (IPv4 or IPv6) falls within a private,
 * loopback, link-local, or otherwise restricted network range.
 *
 * The following ranges are considered private/blocked:
 *
 * **IPv4:**
 * - `127.0.0.0/8` (loopback)
 * - `10.0.0.0/8` (RFC 1918 private)
 * - `172.16.0.0/12` (RFC 1918 private)
 * - `192.168.0.0/16` (RFC 1918 private)
 * - `169.254.0.0/16` (link-local)
 * - `0.0.0.0/8` ("this" network)
 *
 * **IPv6:**
 * - `::1/128` (loopback)
 * - `fc00::/7` (unique local)
 * - `fe80::/10` (link-local)
 * - `::ffff:0:0/96` (IPv4-mapped, with embedded IPv4 also checked)
 *
 * Unparseable addresses are treated as unsafe and return `true`.
 *
 * @param ip - The IP address to test (e.g. `"10.0.0.5"`, `"::1"`).
 * @returns `true` if the address is in a blocked range, `false` otherwise.
 *
 * @example
 * ```ts
 * isPrivateIP('127.0.0.1');          // true
 * isPrivateIP('192.168.1.1');        // true
 * isPrivateIP('8.8.8.8');            // false
 * isPrivateIP('::1');                // true
 * isPrivateIP('2607:f8b0:4004::');   // false
 * ```
 */
export function isPrivateIP(ip: string): boolean {
  // Check IPv4
  const v4 = parseIPv4(ip);
  if (v4 !== null) {
    for (const range of blockedIPv4Ranges) {
      if ((v4 & range.mask) === range.base) {
        return true;
      }
    }
    return false;
  }

  // Check IPv6
  const v6 = parseIPv6(ip);
  if (v6 !== null) {
    // Also check if this is an IPv4-mapped IPv6 address (::ffff:x.x.x.x)
    // and validate the embedded IPv4 portion against IPv4 rules.
    const IPV4_MAPPED_PREFIX = 0x0000_0000_0000_0000_0000_ffff_0000_0000n;
    const IPV4_MAPPED_MASK   = 0xffff_ffff_ffff_ffff_ffff_ffff_0000_0000n;
    if ((v6 & IPV4_MAPPED_MASK) === IPV4_MAPPED_PREFIX) {
      const embeddedV4 = v6 & 0xffff_ffffn;
      for (const range of blockedIPv4Ranges) {
        if ((embeddedV4 & range.mask) === range.base) {
          return true;
        }
      }
    }

    for (const range of blockedIPv6Ranges) {
      if ((v6 & range.mask) === range.base) {
        return true;
      }
    }
    return false;
  }

  // Unparseable addresses are treated as unsafe.
  return true;
}

// ---------------------------------------------------------------------------
// Environment-based allow/block lists
// ---------------------------------------------------------------------------

/**
 * Read a comma-separated environment variable into a `Set` of lower-cased,
 * trimmed hostnames. Returns an empty set if the variable is unset or empty.
 */
function readHostList(envVar: string): Set<string> {
  const raw = process.env[envVar];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

/**
 * Validate a connection target (hostname + port) against SSRF protection
 * rules before establishing a network connection.
 *
 * The function performs the following checks **in order**:
 *
 * 1. If `CONNECTOR_BLOCKED_HOSTS` is set and the hostname appears in it, the
 *    connection is **blocked** immediately.
 * 2. If `CONNECTOR_ALLOWED_HOSTS` is set and the hostname appears in it, the
 *    connection is **allowed** immediately (DNS checks are skipped).
 * 3. If `CONNECTOR_ALLOWED_HOSTS` is set but the hostname is *not* in it, the
 *    connection is **blocked** (strict allowlist mode).
 * 4. The hostname is resolved via DNS (`A` and `AAAA` records).
 * 5. **Every** resolved IP is checked against private / reserved ranges. If
 *    *any* IP is private the connection is blocked (DNS rebinding protection).
 * 6. The cloud metadata endpoint `169.254.169.254` is explicitly blocked.
 *
 * **Environment variables:**
 * - `CONNECTOR_ALLOWED_HOSTS` – Comma-separated list of hostnames that are
 *   always permitted. When set, *only* these hosts are allowed (strict mode).
 * - `CONNECTOR_BLOCKED_HOSTS` – Comma-separated list of hostnames that are
 *   always denied, regardless of other rules.
 *
 * @param hostname - The hostname (or IP literal) of the target.
 * @param port     - The TCP port of the target (validated for range 1-65535).
 * @returns A promise that resolves to a {@link ValidationResult}.
 *
 * @example
 * ```ts
 * const result = await validateConnectionTarget('db.neon.tech', 5432);
 * if (!result.safe) {
 *   throw new Error(`Connection blocked: ${result.reason}`);
 * }
 * ```
 */
export async function validateConnectionTarget(
  hostname: string,
  port: number,
): Promise<ValidationResult> {
  const normalizedHost = hostname.trim().toLowerCase();

  // ── 0. Basic sanity checks ────────────────────────────────────────────
  if (!normalizedHost) {
    return { safe: false, reason: 'Hostname is empty' };
  }

  if (port < 1 || port > 65535 || !Number.isInteger(port)) {
    return { safe: false, reason: `Invalid port number: ${port}` };
  }

  // ── 1. Explicit blocklist (env) ───────────────────────────────────────
  const blockedHosts = readHostList('CONNECTOR_BLOCKED_HOSTS');
  if (blockedHosts.has(normalizedHost)) {
    return {
      safe: false,
      reason: `Hostname "${normalizedHost}" is on the blocked hosts list`,
    };
  }

  // ── 2. Explicit allowlist (env) ───────────────────────────────────────
  const allowedHosts = readHostList('CONNECTOR_ALLOWED_HOSTS');
  if (allowedHosts.size > 0 && allowedHosts.has(normalizedHost)) {
    return { safe: true };
  }

  // If an allowlist is configured but the host is NOT on it, block.
  if (allowedHosts.size > 0) {
    return {
      safe: false,
      reason: `Hostname "${normalizedHost}" is not on the allowed hosts list`,
    };
  }

  // ── 3. Check if hostname is already an IP literal ─────────────────────
  if (parseIPv4(normalizedHost) !== null || parseIPv6(normalizedHost) !== null) {
    if (normalizedHost === METADATA_IP) {
      return {
        safe: false,
        reason: 'Connection to cloud metadata endpoint (169.254.169.254) is blocked',
      };
    }
    if (isPrivateIP(normalizedHost)) {
      return {
        safe: false,
        reason: `IP address "${normalizedHost}" resolves to a private/reserved range`,
      };
    }
    return { safe: true };
  }

  // ── 4. DNS resolution ─────────────────────────────────────────────────
  let ipv4Addresses: string[] = [];
  let ipv6Addresses: string[] = [];

  // Resolve A records
  try {
    ipv4Addresses = await resolve4(normalizedHost);
  } catch {
    // ENODATA / ENOTFOUND — no A records is fine, we'll check AAAA next.
  }

  // Resolve AAAA records
  try {
    ipv6Addresses = await resolve6(normalizedHost);
  } catch {
    // ENODATA / ENOTFOUND — no AAAA records is fine.
  }

  const allAddresses = [...ipv4Addresses, ...ipv6Addresses];

  if (allAddresses.length === 0) {
    return {
      safe: false,
      reason: `Hostname "${normalizedHost}" could not be resolved to any IP address`,
    };
  }

  // ── 5. Validate every resolved IP (DNS rebinding protection) ──────────
  for (const ip of allAddresses) {
    // Explicit metadata endpoint check
    if (ip === METADATA_IP) {
      return {
        safe: false,
        reason: `Hostname "${normalizedHost}" resolves to cloud metadata endpoint (${ip})`,
      };
    }

    if (isPrivateIP(ip)) {
      return {
        safe: false,
        reason: `Hostname "${normalizedHost}" resolves to private/reserved IP (${ip})`,
      };
    }
  }

  return { safe: true };
}
