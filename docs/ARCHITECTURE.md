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

Image tools check local file signatures and use browser decoding and Canvas APIs. ImageBitmap is
preferred, with a local object-URL Image fallback for mobile decoders. Output is generated with
`canvas.toBlob()`; the actual output MIME must match the requested format. Bitmap handles, fallback
URLs and canvases are released even on errors. PNG quality is disabled because the encoder is lossless.
JPG output uses a white background for transparent pixels.

### PDF

PDF tools check for the complete ASCII `%PDF-` signature within the first 1024 local bytes, allowing
leading bytes without removing size, MIME, corruption or encryption checks.
They load local `ArrayBuffer` values into bundled `pdf-lib`. Merge reads sources sequentially and
copies pages into a new in-memory PDF. Split retains one parsed document and copies selected pages
into a new PDF; it does not keep a second cached source buffer. Empty, encrypted and damaged PDFs
produce controlled errors. Descending ranges and repeated pages are preserved; malformed and empty
comma entries are rejected before copying pages.

### Shared lifecycle

The three image pages use `image-tool.ts`; the two PDF pages use `pdf-tool.ts`. `tool-ui.ts` owns
result Blob URLs and invalidates downloads whenever input or settings change. Controls are disabled
while asynchronous work runs so results cannot be attributed to a newer file or selection order.
No file state is stored in a global, localStorage, a worker service, or an application database.

### Resource limits

- Images: 25 MiB input, 8192 pixels per side, 16 million pixels total (input and output).
- PDFs: 50 MiB per input, 100 MiB combined merge input, 2000 output pages including repetitions.

These are safeguards for local memory, not paid-tier restrictions. Devices can require smaller files.
Image dimensions are checked after browser decoding; maliciously compressed images can still put
pressure on the decoder. PDF page counts are checked after parsing, so large/complex objects can
consume memory before output-page limits apply. No server fallback exists.

### Static hosting

Cloudflare Pages serves `dist`, including `_headers`. Hashed Astro assets are cached under `/_astro/*`.
The CSP blocks runtime connections and external scripts. CSS is emitted as a self-hosted stylesheet
to comply with the policy. The scripts under `scripts/` and tests are development tooling only.

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
