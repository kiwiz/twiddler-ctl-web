# Repository notes

- `src/lib/index.js` is the dependency-light browser-ESM library export barrel. The Vite/React PWA entry is `index.html` -> `src/main.jsx`; app pages live in `src/pages/` and shared components in `src/components/`. Run it with `npm run dev`, and build it with `npm run build`.
- Always run `npm run build` after making changes.
- Layout JSON is fetched from the latest `master` of `hid-io/layouts` into ignored `public/layouts/` before dev/build; this requires network access. Call and await `initLayouts(publicRoot)` before using layout mappings or text/log codecs; `publicRoot` must resolve to the directory containing `layouts/`. In Node, serve the repo over HTTP (file URLs are not fetchable by Node's `fetch`).
- `test/verify.mjs` is a cross-check, not a self-contained test: first run `npm run predev`, then from the repo root start `python3 -m http.server 8934` in one terminal and run `node --experimental-default-type=module test/verify.mjs` in another. It also expects `/tmp/default.cfg`, `/tmp/system.cfg`, and `/tmp/empty.cfg` reference outputs, which are not included here.
- `src/lib/fsAccess.js` uses the browser File System Access API; the app's folder-picking/sync workflow requires a Chromium-based browser in a secure context. `example.html` remains a legacy CDN-based demo; use the Vite app at `/` for the bundled offline-ready frontend.

## UI layout spacing

- Use MUI `Stack` spacing consistently: `spacing={2}` (16px) between ordinary page/card content, `spacing={1}` (8px) between related controls, and `spacing={0.5}` (4px) between a section title and its description.
- Keep a section's title row (including any adjacent actions or icons) and optional description grouped together; let the parent stack control spacing between sections rather than between a title and its description.
- Use larger spacing only for intentional exceptions, such as the Welcome screen's more spacious layout.
