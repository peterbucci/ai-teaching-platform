# Private teacher material import (#49)

The Materials page (`/teacher/materials`) imports a source for later lesson
authoring. Saving a source does not approve objectives, publish a lesson, or
activate an assignment. It consumes #53's `lib/lessons/sources.ts` and migration
006; there is no importer-specific source store.

## Supported input and limits

- Pasted text and strictly decoded UTF-8 `.txt` / `.md` files.
- Text-only PDFs, parsed by pinned `pdfjs-dist` 6.4.299. All image-containing
  PDFs, including logos and scans with selectable footers, are rejected.
- At most 5,000,000 original bytes and 50,000 extracted UTF-16 code units.
- At most 500 ordered review passages, with extracted passages split at up to
  3,000 characters. Teacher corrections may use the full 50,000-character total.
- PDF extraction has a 10-second deadline, 128 MB V8 old-generation heap limit,
  and at most two concurrent workers per application process. This is not an
  operating-system memory sandbox or a cross-process rate limiter.
- No OCR, Word, PowerPoint, PDF rendering, source URL fetch, or model call.

PDF page numbers come from the parser; Markdown section labels come from explicit
headings. Text order, tables, and formulas still require teacher review. Empty
pages, damaged/encrypted documents, invalid UTF-8, and unreadable characters fail
the whole extraction. Character counts precede trimming/newline normalization.
Pasted text follows standard multipart line endings; uploaded file bytes remain
exact. Approved corrections and the original extraction are stored separately.

## Request and storage boundaries

All routes and pages require an authenticated account that owns a class before
parsing or retrieving material. The shared source service separately scopes
document reads and revision writes to the authenticated owner.

- `POST /api/teacher/materials/preview`: same-origin multipart with exactly one
  `text` or `file`. Returns a validated preview and signed receipt. No save occurs.
- The same endpoint accepts original input plus `receipt` to extend review time,
  preserving extraction, corrections in the UI, and the original request identity.
- `POST /api/teacher/materials`: original input, `receipt`, and a JSON `review`
  field. Review contains title, structured attribution, permitted-use/review
  confirmations, and passage text/inclusion decisions. Revisions also require
  `document_id` and `expected_latest_version`.
- `GET /api/teacher/materials`: owned source versions only.
- `GET /api/teacher/materials/{documentId}?version=N`: one exact owned version.

Actual streamed request bytes are capped before multipart decoding. Receipts
bind the authenticated actor, original-byte hash, extraction/references, expiry,
and save request identity. Save rehashes the resubmitted original. Passage IDs,
ordering, and page/section references cannot be replaced by review input. The
shared store computes authoritative hashes/IDs and preserves immutable versions,
idempotent identical retries, and optimistic revision checks.

Original assets stay in private PostgreSQL bytea storage; no public asset URL or
download endpoint is created. Source text, including uploaded instructions and
Markdown/HTML, is rendered as escaped plain text. The source reference has no
fabricated Git commit. Private source material is never written to the repository.

## PDF implementation review notes

The worker uses a guarded internal operator stream from the exact pinned PDF.js
version. Its public `getOperatorList()` can resolve a partial list before reporting
an image-limit error; the stream lets the importer fail closed instead. Image
size zero prevents image decode, and missing/changing internals reject extraction.
Re-review this adapter and its scan/late-image tests before upgrading PDF.js.

The native worker constructor is resolved at runtime because Next's bundler
otherwise rewrites the worker and breaks PDF.js's sibling worker resolution.
The existing Docker image copies `lib/`, so the same filesystem worker is present
in the production image.

## Verification and integration

`npm test` includes parser, receipt/review, and streamed-request tests with generated
synthetic PDFs. `npm run materials:check` requires a running configured application
and fictional demo accounts/database. It verifies actual HTTP extraction, review,
private bytes, save/reload, access denial, replay, and immutable revision history.
It retains clearly labeled synthetic source versions because history is append-only;
run it only in an isolated fictional test environment. No paid model calls occur.

The PR depends on #53 / PR #93. #50 consumes approved passages, #51 builds question
drafts, and #52 publishes lessons. Those later workflows are not implemented or
claimed by the importer. Protected guides and the curated networking package stay
unchanged.
