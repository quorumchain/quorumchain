// Quorumchain ($QRM) — deployable node config + pinned trust root (spec NI-D1/D2).
// The node verifies published snapshots against keys PINNED HERE, never keys carried
// in an upload. chainId stamps the pinned validator set + protocol version so a
// wrong-chain volume is detectable. Zero dependencies.

import { createHash } from 'node:crypto';

export const PROTOCOL_VERSION = 'qrm-node-1';

export interface NodeLimits {
  maxBodyBytes: number; maxQuestionLen: number; maxContextLen: number;
  rateWindowMs: number; rateMaxPerWindow: number; inboxMaxBytes: number; nearDupThreshold: number;
}

export interface NodeConfig {
  dataDir: string; port: number; submitToken: string; adminToken: string;
  pinnedKeyring: Record<string, string>; chainId: string; quorum: number; limits: NodeLimits;
  allowedOrigins: string[];
}

const DEFAULT_LIMITS: NodeLimits = {
  maxBodyBytes: 64 * 1024, maxQuestionLen: 2000, maxContextLen: 16000,
  rateWindowMs: 60_000, rateMaxPerWindow: 20, inboxMaxBytes: 8 * 1024 * 1024, nearDupThreshold: 0.8,
};

export function chainIdFor(keyring: Record<string, string>): string {
  const validators = Object.keys(keyring).sort().map((id) => ({ id, key: keyring[id] }));
  return createHash('sha256')
    .update(JSON.stringify({ namespace: 'quorumchain', protocolVersion: PROTOCOL_VERSION, validators }), 'utf8')
    .digest('hex');
}

export function loadConfig(env: Record<string, string | undefined>, keyring: Record<string, string>): NodeConfig {
  const require = (k: string): string => {
    const v = env[k];
    if (!v) throw new Error(`missing required env ${k}`);
    return v;
  };
  if (Object.keys(keyring).length === 0) throw new Error('empty pinned keyring');
  // QRM_MAX_BODY_BYTES override: must be a finite positive integer within a sane bound.
  // Upper bound = 64 MiB (still comfortably admits the ~3 MB published snapshot). On a bad
  // value we throw at load rather than silently falling back, consistent with require().
  const MAX_BODY_BYTES_CEILING = 64 * 1024 * 1024;
  const maxBodyBytes = ((): number => {
    const v = env.QRM_MAX_BODY_BYTES;
    if (v === undefined || v === '') return DEFAULT_LIMITS.maxBodyBytes;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0 || n > MAX_BODY_BYTES_CEILING)
      throw new Error(`invalid QRM_MAX_BODY_BYTES: must be a positive integer <= ${MAX_BODY_BYTES_CEILING}`);
    return n;
  })();
  return {
    dataDir: require('QRM_NODE_DATA'),
    port: env.QRM_NODE_PORT ? Number(env.QRM_NODE_PORT) : 8787,
    submitToken: require('QRM_SUBMIT_TOKEN'),
    adminToken: require('QRM_ADMIN_TOKEN'),
    pinnedKeyring: keyring,
    chainId: chainIdFor(keyring),
    quorum: env.QRM_QUORUM ? Number(env.QRM_QUORUM) : 2,
    limits: { ...DEFAULT_LIMITS, maxBodyBytes },
    allowedOrigins: (env.QRM_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}
