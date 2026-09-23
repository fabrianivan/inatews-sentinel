#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('\x1b[35m%s\x1b[0m', '🌋 Starting Krakatau Sentinel (Backend + Frontend)...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const backendEnv = {
  ...process.env,
  DEMO_MODE: process.env.DEMO_MODE || 'true',
  SERVER_PORT: process.env.SERVER_PORT || '8080',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
};

// 1. Start Go Backend
console.log('\x1b[36m%s\x1b[0m', '🚀 [BACKEND] Starting Go API server on :8080...');
const backend = spawn('go', ['run', 'cmd/server/main.go'], {
  cwd: path.join(rootDir, 'backend'),
  stdio: 'inherit',
  env: backendEnv,
});

backend.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `❌ [BACKEND ERROR] ${err.message}`);
});

// 2. Start Next.js Dashboard
console.log('\x1b[32m%s\x1b[0m', '🌐 [FRONTEND] Starting Next.js dashboard on :3000...');
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'dashboard'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080',
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },
});

frontend.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `❌ [FRONTEND ERROR] ${err.message}`);
});

// Handle termination
function cleanup() {
  console.log('\n\x1b[33m%s\x1b[0m', '🛑 Shutting down Krakatau Sentinel...');
  try { backend.kill('SIGINT'); } catch (_) {}
  try { frontend.kill('SIGINT'); } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
