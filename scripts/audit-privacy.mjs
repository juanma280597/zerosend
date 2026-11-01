import { readdir, readFile } from 'node:fs/promises';

// Deliberately conservative gate. Every match needs a human privacy-boundary review.
const prohibited = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\bimportScripts\s*\(|<form\b|https?:\/\/[^\s'"<>]+/g;
// Schema identifiers and build-time canonical fallbacks are not network operations.
const identifiers = new Set(['https://schema.org', 'https://zerosend.example', 'https://schema.org/WebApplication', 'http://www.sitemaps.org/schemas/sitemap/0.9']);
const matches = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await scan(path); continue; }
    const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(prohibited)) {
        if (!identifiers.has(match[0])) matches.push(`${path}:${index + 1}: ${match[0]}`);
      }
    });
  }
}
await scan('src');
await scan('public');
if (matches.length) {
  console.error(matches.join('\n'));
  console.error('Review network primitives and URLs against AGENTS.md before proceeding.');
  process.exitCode = 1;
} else console.log('Privacy source audit passed: no network primitives, remote assets or forms.');
