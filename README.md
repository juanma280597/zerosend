# ZeroSend

> **Internal project codename:** LocalTools  
> **Public working brand:** ZeroSend  
> **Tagline:** Process files. Send nothing.

ZeroSend is a privacy-first collection of free browser tools for everyday file tasks. The core rule is simple: selected files are processed on the user's device instead of being uploaded to an application server.

## MVP

- Image Compressor
- JPG / PNG to WebP
- Image Resizer
- Merge PDF
- Split PDF / page extractor

## Architecture

- **Astro 7.4.4** for static pages and SEO-friendly HTML.
- **TypeScript / browser JavaScript** for local processing.
- **Canvas / ImageBitmap APIs** for image operations.
- **pdf-lib 1.17.1** for PDF merge and page extraction.
- **No application backend, database, login, or file-processing API** in the MVP.
- Target hosting: **Cloudflare Pages** from GitHub.

## Privacy invariant

Tool code must never transmit selected file bytes, file contents, extracted text, previews, or filenames over the network. See `AGENTS.md` and `SECURITY.md` before changing processing code.

This does **not** mean a deployed website has zero network traffic: HTML, JS, CSS, consent tooling, analytics, and ads can make ordinary requests. Those systems must remain isolated from selected-file data.

## Local development

Requirements:

- Node.js 22.23.4 or newer supported even-numbered release
- npm

```bash
npm ci
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

Validation (also run by GitHub Actions):

```bash
npm run check
npm test
npm run audit:privacy
npm run build
npx playwright install chromium webkit
npm run test:browser
```

On Linux, install browser system dependencies with `npx playwright install --with-deps chromium webkit`.
Playwright and Node type definitions are development-only dependencies; no testing code is shipped.
Browser tests serve `dist` with the production CSP and use synthetic files only. The local test
server is a test harness, not an application backend or deployment requirement.
See [docs/V0.1-HARDENING.md](docs/V0.1-HARDENING.md) for coverage, limits and the manual release checklist.

## Environment

Copy `.env.example` to `.env` when needed.

```text
PUBLIC_SITE_URL=https://your-domain.example
```

Do not enable AdSense in the MVP until the site has a real domain, completed privacy/consent pages, meaningful publisher content, and policy review.
Set `PUBLIC_SITE_URL` to the real HTTPS production origin before building for deployment;
the fallback `zerosend.example` is a placeholder for local builds, canonical URLs and the sitemap.

## Deployment target

Cloudflare Pages settings:

- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22.23.4` or newer supported release

## Product principles

1. Tool first: the useful action is visible immediately.
2. Local by design: no upload round-trip for supported tools.
3. Honest privacy language: distinguish file processing from normal site/ad network traffic.
4. Mobile-first: every core task must work comfortably from a phone.
5. SEO with substance: one page per real search intent, with manually reviewed explanations and FAQ—not thin generated pages.
6. Minimal dependencies: every dependency increases bundle, security, and privacy surface.

## Status

`v0.1 hardening` — five local-processing tools with input validation, bounded output dimensions/pages,
temporary URL cleanup, reproducible installs, and regression tests. Physical Android/iPhone checks
and production hosting/header verification remain release checks. No ads, analytics or CMP are enabled.
