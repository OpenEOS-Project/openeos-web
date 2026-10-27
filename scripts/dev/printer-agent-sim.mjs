#!/usr/bin/env node
/**
 * Simulated printer agent — for testing the "Drucker" page without a
 * physical printer or the Python agent.
 *
 * What it does, like the real openeos-printer-agent:
 *   1. `POST /devices/init` as `printer_agent` and prints the 6-digit pairing
 *      code (skipped when a device token is stored from a previous run).
 *   2. Polls `GET /devices/status` until an org admin has entered the code.
 *   3. Connects to the socket (device token), sends `agentHeartbeat` every
 *      30 s with the adopted printers as online, and posts a few discovered
 *      printers (USB, network, Windows spooler) to
 *      `POST /device-api/printers/discovered`.
 *   4. Reacts to `printerDiscover` (re-posts; with `subnetScan` an extra
 *      port-scan hit appears), `printerConfigUpdate` (reloads
 *      `GET /device-api/printers`) and `printerJob` (acks with
 *      `printerJobComplete` after a short delay).
 *
 * Usage:
 *   node scripts/dev/printer-agent-sim.mjs [--api http://localhost:3001] [--name "Drucker-Agent sim"]
 *                                           [--state .printer-agent-sim.json] [--os windows|linux] [--reset]
 *
 * The device token is kept in the state file so a restart reuses the same
 * agent (`--reset` starts over). Point `--api` at the API base URL without
 * `/api`; `OPENEOS_API_URL` works as well. Needs the repo's node_modules
 * (socket.io-client) — run it from the repo root.
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { hostname } from 'node:os';
import { io } from 'socket.io-client';

const args = parseArgs(process.argv.slice(2));
const API_BASE = (args.api ?? process.env.OPENEOS_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const API = `${API_BASE}/api`;
const STATE_FILE = args.state ?? '.printer-agent-sim.json';
const AGENT_OS = args.os ?? 'linux';
const AGENT_NAME = args.name ?? `Drucker-Agent ${hostname()}`;
const HEARTBEAT_MS = 30_000;
const VERSION = '0.0.0-sim';

if (args.reset && existsSync(STATE_FILE)) unlinkSync(STATE_FILE);

const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
let adoptedPrinters = [];
let subnetScanned = false;

// ---------------------------------------------------------------------------
// What the agent "finds". Fingerprints follow the spec:
// usb:<vendor>:<product>:<serial|->, net:<mac|ip>, win:<printerName>.
// ---------------------------------------------------------------------------
function discoveredPrinters({ includePortScan }) {
  const list = [
    {
      fingerprint: 'usb:04b8:0202:X7K123',
      connectionType: 'usb',
      displayName: 'EPSON TM-T88V',
      details: { manufacturer: 'EPSON', product: 'TM-T88V', serialNumber: 'X7K123', usbVendorId: '04b8', usbProductId: '0202' },
      discoveredVia: 'usb',
    },
    {
      fingerprint: 'net:aa:bb:cc:dd:ee:01',
      connectionType: 'network',
      displayName: 'Star TSP143 (Theke)',
      details: { manufacturer: 'Star', model: 'TSP143IIILAN', ipAddress: '192.168.1.50', port: 9100, hostname: 'star-theke', macAddress: 'aa:bb:cc:dd:ee:01' },
      discoveredVia: 'mdns',
    },
  ];
  if (AGENT_OS === 'windows') {
    list.push({
      fingerprint: 'win:Bondrucker Küche',
      connectionType: 'windows',
      displayName: 'Bondrucker Küche',
      details: { windowsPrinterName: 'Bondrucker Küche', driverName: 'Generic / Text Only' },
      discoveredVia: 'spooler',
    });
  }
  if (includePortScan) {
    list.push({
      fingerprint: 'net:192.168.1.77',
      connectionType: 'network',
      displayName: 'Netzwerkdrucker 192.168.1.77',
      details: { ipAddress: '192.168.1.77', port: 9100, model: 'TM-T20III' },
      discoveredVia: 'portscan',
    });
  }
  return list;
}

// ---------------------------------------------------------------------------
async function main() {
  if (!state.deviceToken) {
    const init = await api('POST', '/devices/init', {
      deviceType: 'printer_agent',
      suggestedName: AGENT_NAME,
      userAgent: `openeos-printer-agent-sim/${VERSION}`,
    });
    state.deviceToken = init.deviceToken;
    state.deviceId = init.deviceId;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    banner(`PAIRING CODE: ${init.verificationCode}`);
    console.log(`Device ${init.deviceId} registered — enter the code under Drucker → "Drucker-Agent verbinden".`);
  } else {
    console.log(`Reusing device ${state.deviceId} from ${STATE_FILE}`);
  }

  await waitForVerification();
  await loadPrinters();
  connectSocket();
  await reportDiscovered({ includePortScan: false, full: true });
}

async function waitForVerification() {
  for (;;) {
    const status = await api('GET', '/devices/status', undefined, true).catch((err) => {
      console.error(`status failed: ${err.message}`);
      return null;
    });
    if (status?.status === 'verified') {
      console.log(`Verified — organisation ${status.organizationName ?? status.organizationId}`);
      return;
    }
    if (status?.status === 'blocked') throw new Error('Device is blocked');
    await sleep(3000);
  }
}

async function loadPrinters() {
  const res = await api('GET', '/device-api/printers', undefined, true);
  adoptedPrinters = res.printers ?? [];
  console.log(`Adopted printers: ${adoptedPrinters.length}${adoptedPrinters.map((p) => `\n  - ${p.name} [${p.connectionType}] ${p.fingerprint ?? '(manual)'} ${p.isActive ? '' : '(inactive)'}`).join('')}`);
}

async function reportDiscovered({ includePortScan, full }) {
  const printers = discoveredPrinters({ includePortScan });
  const res = await api('POST', '/device-api/printers/discovered', { printers, full }, true);
  console.log(`Reported ${printers.length} discovered printer(s)` + (res?.printers ? ` → ${res.printers.filter((p) => p.printerId).length} already adopted` : ''));
}

function heartbeatPayload() {
  return {
    version: VERSION,
    os: AGENT_OS,
    arch: 'x86_64',
    hostname: hostname(),
    pythonVersion: '3.12.0',
    capabilities: { usb: true, mdns: true, portscan: true, spooler: AGENT_OS === 'windows' },
    printers: adoptedPrinters
      .filter((p) => typeof p.fingerprint === 'string' || p.id)
      .map((p) => ({ fingerprint: p.fingerprint ?? `manual:${p.id}`, printerId: p.id, online: p.isActive !== false })),
  };
}

function connectSocket() {
  const socket = io(API_BASE, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { deviceToken: state.deviceToken },
    reconnection: true,
    reconnectionDelayMax: 10_000,
  });
  let heartbeatTimer;

  const sendHeartbeat = () => {
    socket.emit('agentHeartbeat', heartbeatPayload());
    for (const p of adoptedPrinters) {
      socket.emit('printerHeartbeat', { printerId: p.id, agentId: state.deviceId, isOnline: p.isActive !== false });
    }
  };

  socket.on('connected', (data) => {
    console.log(`Socket connected (${data?.deviceId ?? '?'})`);
    sendHeartbeat();
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);
  });
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${reason}`);
    clearInterval(heartbeatTimer);
  });
  socket.on('connect_error', (err) => console.error(`Socket error: ${err.message}`));
  socket.on('error', (err) => console.error(`Server error: ${err?.message ?? JSON.stringify(err)}`));

  socket.on('printerDiscover', async (payload, ack) => {
    console.log(`printerDiscover received (subnetScan=${Boolean(payload?.subnetScan)})`);
    if (typeof ack === 'function') ack({ received: true });
    subnetScanned = subnetScanned || Boolean(payload?.subnetScan);
    // A real scan takes a moment; this keeps the "Suche gestartet" toast honest.
    await sleep(1500);
    await reportDiscovered({ includePortScan: subnetScanned, full: true }).catch((err) =>
      console.error(`reporting failed: ${err.message}`),
    );
  });

  socket.on('printerConfigUpdate', async () => {
    console.log('printerConfigUpdate received — reloading printers');
    await loadPrinters().catch((err) => console.error(`reload failed: ${err.message}`));
    sendHeartbeat();
  });

  socket.on('printerJob', async (job) => {
    console.log(`printerJob ${job.jobId} for printer ${job.printerId} (template ${job.templateName}, ${job.copies}x)`);
    await sleep(800);
    socket.emit('printerJobComplete', { jobId: job.jobId, agentId: state.deviceId });
    console.log(`  → completed ${job.jobId}`);
  });

  socket.on('openCashDrawer', (payload) => console.log(`openCashDrawer ${JSON.stringify(payload)}`));
  socket.on('templateUpdate', () => console.log('templateUpdate received'));

  const shutdown = () => {
    console.log('Bye.');
    clearInterval(heartbeatTimer);
    socket.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ---------------------------------------------------------------------------
async function api(method, path, body, withToken = false) {
  const headers = { 'content-type': 'application/json' };
  if (withToken) headers['x-device-token'] = state.deviceToken;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.error?.message ?? json?.message ?? res.statusText;
    throw new Error(`${method} ${path} → ${res.status} ${message}`);
  }
  return json?.data ?? json;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function banner(text) {
  const line = '═'.repeat(text.length + 6);
  console.log(`\n╔${line}╗\n║   ${text}   ║\n╚${line}╝\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
