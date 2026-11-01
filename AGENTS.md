# AGENTS.md — ZeroSend engineering rules

These instructions apply to Codex and any automated coding agent working in this repository.

## Non-negotiable privacy boundary

For all file-processing tools:

- NEVER upload selected file bytes to an API, server, analytics endpoint, logging endpoint, AI service, CDN transform endpoint, or third party.
- NEVER send filenames, extracted text, image pixels, PDF metadata, previews, hashes, or generated output derived from selected files over the network.
- NEVER add `fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, `WebSocket`, form POST, remote image transformation, or server-side upload code to a processing flow.
- File processing must remain in the browser using browser APIs or client-side libraries bundled with the site.
- Ads, consent tooling, and analytics must be architecturally isolated from file state. Do not place file-derived values in DOM attributes or globals consumed by third-party scripts.

## Product rules

- Keep the MVP fully static. No backend, database, login, account system, upload API, serverless function, or paid dependency unless the owner explicitly approves a new architecture stage.
- Prefer browser-native APIs over new packages.
- Keep dependencies minimal and pinned.
- Every tool page needs a real title, description, explanatory content, privacy note, limitations, FAQ, and related-tool links where useful.
- Do not generate large numbers of thin SEO pages.
- Mobile is a primary target, not an afterthought.
- Maintain keyboard accessibility, visible focus states, labels, status messages, and useful errors.

## Testing before commit

Run, at minimum:

```bash
npm ci
npm run check
npm run build
```

Then search processing code for prohibited network primitives:

```bash
grep -RInE "fetch\\(|XMLHttpRequest|sendBeacon|WebSocket" src public || true
```

A match is not automatically a defect, but every match must be reviewed against the privacy boundary.

## Architecture

- Astro static output
- TypeScript
- Browser Canvas / ImageBitmap for image manipulation
- pdf-lib for PDF merge/extraction
- Cloudflare Pages target

## Git workflow

- Use focused commits.
- Avoid drive-by refactors while implementing a feature.
- Never delete working functionality to simplify a task unless explicitly approved.
- Update documentation when behavior or architecture changes.
