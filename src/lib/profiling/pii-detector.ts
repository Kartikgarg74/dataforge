/**
 * PII Detection
 *
 * Detects columns that likely contain Personally Identifiable Information.
 * Used to warn users before exporting datasets containing PII.
 */

interface PIIDetection {
  column: string;
  piiType: PIIType;
  confidence: 'high' | 'medium' | 'low';
  sampleMatch?: string;
}

type PIIType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'ip_address' | 'name' | 'address';

const PII_PATTERNS: Array<{
  type: PIIType;
  namePatterns: RegExp[];
  valuePattern?: RegExp;
  confidence: 'high' | 'medium';
}> = [
  {
    type: 'email',
    namePatterns: [/email/i, /e_mail/i, /mail_address/i],
    valuePattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    confidence: 'high',
  },
  {
    type: 'phone',
    namePatterns: [/phone/i, /tel/i, /mobile/i, /cell/i, /fax/i],
    valuePattern: /^[+]?[\d\s().-]{7,20}$/,
    confidence: 'high',
  },
  {
    type: 'ssn',
    namePatterns: [/ssn/i, /social_security/i, /sin/i, /national_id/i, /tax_id/i],
    valuePattern: /^\d{3}-?\d{2}-?\d{4}$/,
    confidence: 'high',
  },
  {
    type: 'credit_card',
    namePatterns: [/credit_card/i, /card_number/i, /cc_num/i, /card_no/i],
    valuePattern: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
    confidence: 'high',
  },
  {
    type: 'ip_address',
    namePatterns: [/ip_address/i, /ip_addr/i, /client_ip/i, /remote_addr/i],
    valuePattern: /^(\d{1,3}\.){3}\d{1,3}$/,
    confidence: 'medium',
  },
  {
    type: 'name',
    namePatterns: [/^first_?name$/i, /^last_?name$/i, /^full_?name$/i, /^name$/i, /^user_?name$/i],
    confidence: 'medium',
  },
  {
    type: 'address',
    namePatterns: [/^address$/i, /street/i, /city/i, /zip_?code/i, /postal/i, /state/i],
    confidence: 'medium',
  },
];

/**
 * Detect PII columns by column name patterns and optional value patterns.
 */
export function detectPII(
  columns: Array<{ name: string; sampleValues?: unknown[] }>
): PIIDetection[] {
  const detections: PIIDetection[] = [];

  for (const col of columns) {
    for (const pattern of PII_PATTERNS) {
      // Check column name
      const nameMatch = pattern.namePatterns.some((p) => p.test(col.name));
      if (!nameMatch) continue;

      // Check value pattern if available
      let valueMatch = false;
      let sampleMatch: string | undefined;

      if (pattern.valuePattern && col.sampleValues) {
        const stringValues = col.sampleValues
          .filter((v) => v !== null && v !== undefined)
          .map(String);

        const matchCount = stringValues.filter((v) => pattern.valuePattern!.test(v)).length;
        valueMatch = stringValues.length > 0 && matchCount / stringValues.length >= 0.5;

        if (valueMatch) {
          sampleMatch = stringValues.find((v) => pattern.valuePattern!.test(v));
        }
      }

      // If name matches and (no value pattern to check OR value pattern matches)
      if (nameMatch && (!pattern.valuePattern || valueMatch || !col.sampleValues)) {
        detections.push({
          column: col.name,
          piiType: pattern.type,
          confidence: valueMatch ? 'high' : pattern.confidence,
          sampleMatch,
        });
        break; // One detection per column
      }
    }
  }

  return detections;
}

/**
 * Get column names that should be removed for PII safety.
 */
export function getPIIColumnNames(
  columns: Array<{ name: string; sampleValues?: unknown[] }>
): string[] {
  const detections = detectPII(columns);
  return detections
    .filter((d) => d.confidence === 'high')
    .map((d) => d.column);
}

/**
 * Generate PII warnings for the user.
 */
export function getPIIWarnings(
  columns: Array<{ name: string; sampleValues?: unknown[] }>
): string[] {
  const detections = detectPII(columns);
  return detections.map((d) => {
    const prefix = d.confidence === 'high' ? '⚠️' : 'ℹ️';
    return `${prefix} Column '${d.column}' may contain ${d.piiType.replace('_', ' ')} (${d.confidence} confidence)`;
  });
}
