/**
 * S3 Upload
 *
 * Uploads a buffer to Amazon S3 using a minimal AWS Signature V4 signing
 * implementation. No AWS SDK dependency required.
 */

import { createHmac, createHash } from 'crypto';

export interface S3UploadOptions {
  /** The file content to upload */
  buffer: Buffer;
  /** S3 bucket name */
  bucket: string;
  /** Object key (path) in the bucket */
  key: string;
  /** AWS region (e.g. 'us-east-1') */
  region: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /** Optional content type (defaults to 'application/octet-stream') */
  contentType?: string;
}

/**
 * Upload a buffer to S3 using AWS Signature V4 signing.
 * Returns the S3 URL of the uploaded object.
 */
export async function uploadToS3(options: S3UploadOptions): Promise<string> {
  const {
    buffer,
    bucket,
    key,
    region,
    accessKeyId,
    secretAccessKey,
    contentType = 'application/octet-stream',
  } = options;

  if (!bucket) throw new Error('S3 bucket is required');
  if (!key) throw new Error('S3 key is required');
  if (!region) throw new Error('AWS region is required');
  if (!accessKeyId) throw new Error('AWS access key ID is required');
  if (!secretAccessKey) throw new Error('AWS secret access key is required');

  const service = 's3';
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const url = `https://${host}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;

  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);

  // Hash the payload
  const payloadHash = sha256Hex(buffer);

  // Canonical headers
  const headers: Record<string, string> = {
    host,
    'content-type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  const signedHeaderKeys = Object.keys(headers).sort();
  const signedHeaders = signedHeaderKeys.join(';');

  const canonicalHeaders = signedHeaderKeys
    .map((k) => `${k}:${headers[k]}\n`)
    .join('');

  // Canonical request
  const encodedKey = '/' + key.split('/').map(encodeURIComponent).join('/');
  const canonicalRequest = [
    'PUT',
    encodedKey,
    '', // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest, 'utf-8')),
  ].join('\n');

  // Signing key
  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacSha256Hex(signingKey, stringToSign);

  // Authorization header
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  // Make the PUT request
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `S3 upload failed (HTTP ${response.status}): ${errorBody}`
    );
  }

  return url;
}

// --- AWS Signature V4 helpers ---

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function toDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256')
    .update(data)
    .digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf-8').digest();
}

function hmacSha256Hex(key: Buffer | string, data: string): string {
  return createHmac('sha256', key).update(data, 'utf-8').digest('hex');
}

function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}
