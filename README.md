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
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Environment

Copy `.env.example` to `.env` when needed.

```text
PUBLIC_SITE_URL=https://your-domain.example
PUBLIC_ADSENSE_CLIENT=
```

Do not enable AdSense in the MVP until the site has a real domain, completed privacy/consent pages, meaningful publisher content, and policy review.

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

`v0.1 bootstrap` — five MVP tool pages and static architecture prepared. Build verification must be run in an environment meeting Astro's current Node requirement.
