# ZeroSend architecture

## Goal

Build useful free file tools that can be hosted as a static website while keeping selected files on the user's device.

## Runtime model

```text
Static host / CDN
        |
        | HTML, CSS, JS, library bundles
        v
User's browser
        |
        +--> File API / Blob / ArrayBuffer
        +--> Canvas / ImageBitmap
        +--> pdf-lib
        |
        v
Local generated Blob --> user download
```

There is intentionally no application upload server in v0.1.

## Tool processing

### Images

Image tools use browser decoding and Canvas APIs. Input is read into an object URL and decoded locally. Output is generated with `canvas.toBlob()`.

### PDF

PDF tools load local `ArrayBuffer` values into `pdf-lib`. Merge copies pages into a new in-memory PDF. Split/extract copies selected pages into a new PDF.

## Third-party boundary

AdSense, a CMP, and optional analytics belong outside the processing modules. Processing modules must not import advertising or analytics code and file-derived values must not be exposed to third-party scripts.

## Why static Astro

- Server-rendered HTML at build time for crawlability.
- Minimal client JavaScript: only the tool interaction needs to hydrate/run.
- Easy deployment from GitHub to Cloudflare Pages.
- No idle application server cost.
- Pages can include substantive SEO content without converting the product into an SPA.

## Future performance work

When actual usage data justifies it:

- Web Workers for CPU-heavy operations.
- Batch image processing.
- Local ZIP generation for multi-output jobs.
- PWA/offline support.
- Lazy-load heavy PDF code only on PDF routes.

Avoid adding architecture merely because it may be useful later.
