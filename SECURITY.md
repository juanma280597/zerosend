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
