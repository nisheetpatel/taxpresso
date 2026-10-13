// Preloaded into the extension process by the offline test (node --import). Blocks and records every
// attempt to reach anything other than this computer: TCP/TLS connects, DNS lookups, UDP, fetch,
// WebSocket and child processes. Loopback (127.0.0.0/8, ::1, localhost) and local pipes stay allowed.
// Each attempt is appended as a JSON line to $TAXPRESSO_NET_GUARD_LOG; the test fails if that file exists.

import { appendFileSync, writeFileSync } from 'node:fs';
import childProcess from 'node:child_process';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';

const logFile = process.env.TAXPRESSO_NET_GUARD_LOG;
// Proof for the test that the guard really runs inside the process under test.
if (logFile) writeFileSync(`${logFile}.pid`, String(process.pid));

function isLoopback(host) {
  if (host === undefined || host === null || host === '') return true; // Node defaults to localhost
  const h = String(host)
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  return h === 'localhost' || h === '::1' || h.startsWith('127.') || h === '::ffff:127.0.0.1';
}

function blocked(kind, target) {
  const entry = {
    kind,
    target: String(target),
    at: new Date().toISOString(),
    stack: new Error().stack,
  };
  if (logFile) appendFileSync(logFile, JSON.stringify(entry) + '\n');
  const err = new Error(`Taxpresso offline guard: blocked ${kind} to ${target}`);
  err.code = 'ETAXPRESSOOFFLINE';
  return err;
}

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const opts =
    typeof args[0] === 'object' && args[0] !== null
      ? Array.isArray(args[0])
        ? args[0][0]
        : args[0]
      : null;
  const isPipe =
    (opts && opts.path) || (typeof args[0] === 'string' && Number.isNaN(Number(args[0])));
  const host = opts ? opts.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (!isPipe && !isLoopback(host)) {
    const err = blocked('tcp-connect', `${host}:${opts ? opts.port : args[0]}`);
    process.nextTick(() => this.destroy(err));
    return this;
  }
  return connect.apply(this, args);
};

const lookup = dns.lookup;
dns.lookup = function (hostname, ...rest) {
  if (!isLoopback(hostname)) throw blocked('dns-lookup', hostname);
  return lookup.call(this, hostname, ...rest);
};
const promisesLookup = dns.promises.lookup;
dns.promises.lookup = async function (hostname, ...rest) {
  if (!isLoopback(hostname)) throw blocked('dns-lookup', hostname);
  return promisesLookup.call(this, hostname, ...rest);
};
for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const name of Object.keys(target)) {
    if (/^resolve|^reverse$/.test(name) && typeof target[name] === 'function') {
      target[name] = function (host) {
        throw blocked('dns-resolve', host);
      };
    }
  }
}

const send = dgram.Socket.prototype.send;
dgram.Socket.prototype.send = function (msg, ...rest) {
  const address = rest.find((a) => typeof a === 'string');
  if (!isLoopback(address)) throw blocked('udp-send', address);
  return send.call(this, msg, ...rest);
};

if (typeof globalThis.fetch === 'function') {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async function (input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!isLoopback(url.hostname)) throw blocked('fetch', url.href);
    return realFetch(input, init);
  };
}
if (typeof globalThis.WebSocket === 'function') {
  const RealWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = class extends RealWebSocket {
    constructor(url, ...rest) {
      if (!isLoopback(new URL(url).hostname)) throw blocked('websocket', url);
      super(url, ...rest);
    }
  };
}

// The extension has no reason to start programs (a curl would bypass every check above).
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  childProcess[name] = function (command) {
    throw blocked('child-process', command);
  };
}

// Make `import { spawn } from 'node:child_process'` and friends see the patched functions too.
syncBuiltinESMExports();
