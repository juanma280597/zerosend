# Security and privacy policy

## Core guarantee

ZeroSend's supported file tools are designed to process selected files locally in the user's browser. The application does not require an application upload server for those operations.

The guarantee applies to selected-file data: file bytes, filenames, extracted text, previews, image pixels, PDF content, metadata, and generated output must not be transmitted by the processing implementation.

The website itself can still make ordinary network requests for page assets and, in later stages, advertising, consent management, or analytics. Those services must never receive file-derived data.

## Reporting

Do not publish security reports containing private user data. Use the repository's private security reporting feature when enabled, or contact the maintainer through a private channel listed on the production site.

## Dependency policy

- Prefer browser-native APIs.
- Keep the dependency set deliberately small.
- Pin direct dependencies.
- Review client libraries before adding them because they run in the same origin as sensitive local-file workflows.

## v0.1 enforcement and testing

- No advertising, analytics, CMP, remote fonts or remote processing libraries are loaded.
- Cloudflare Pages `_headers` applies a CSP with `connect-src 'none'`, `form-action 'none'`,
  self-hosted scripts/styles and local Blob image previews. Verify these headers after deploying;
  Astro's development/preview servers do not apply Cloudflare's `_headers` file.
- File validation checks bytes/signatures as well as declared MIME types. It is not antivirus scanning.
- Errors shown by the application are controlled messages; library exceptions are not forwarded to
  telemetry or displayed as raw PDF contents. There is no application error-reporting endpoint.
- Result URLs are revoked when inputs/settings change, when a replacement result is created,
  and on page exit. Decoded image handles and canvases are explicitly released.
- `npm run audit:privacy` scans `src` and `public`; browser regression tests also assert no HTTP
  requests occur during selection, processing and downloads. Source scanning alone is not proof
  of privacy; review dependencies, built assets and production host configuration as well.
- File-size, pixel and page limits reduce memory pressure but cannot guarantee every device can
  process every file under those limits. Browser decoders and PDF parsing can still exhaust memory.

Do not enable Cloudflare Web Analytics, injected third-party scripts, or other host transformations
without revisiting this boundary and the CSP. CSP is defense in depth, not a replacement for code review.
