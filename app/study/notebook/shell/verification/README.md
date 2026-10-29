# Reproduce N1 presentation verification

This harness bundles the actual shell and N0 adapter into a standalone page.
It never registers an application route. All displayed records and the textarea
mount probe are fictional fixture content, not live tutoring or a replacement
composer. It does not load `.env` or contact an application/database/provider.

Run normal checks from the repository root:

```sh
node --experimental-strip-types --conditions=react-server --test tests/student-notebook-shell.test.ts
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run content:check
```

The optional browser harness needs `esbuild` and `playwright` in local tooling,
not application dependencies. An existing installation can be supplied through
`NOTEBOOK_ESBUILD` and `NOTEBOOK_PLAYWRIGHT` (absolute module paths). The default
esbuild location is `.setup/verification/node_modules/esbuild`. For example,
install it with `npm install --prefix .setup/verification --no-save esbuild`.
Set `NOTEBOOK_BROWSER` to an installed Chromium/Edge executable, or leave it
unset to use Playwright's installed Chromium. No package/lockfile change is needed.

Set `NOTEBOOK_PORT=0` for a newly allocated loopback port and
`NOTEBOOK_OUTPUT` to a fresh directory, preserving previous runs. Then run:

```sh
node app/study/notebook/shell/verification/browser-check.mjs
```

The harness verifies its new server's exact URL, title and unique response marker
with HTTP **before** starting a fresh browser. It never connects to existing
browser tabs, profiles, debug endpoints or the previously stopped Computer Use
session. Fixture requests are restricted to the exact local origin and GET;
nonlocal requests and mutations fail the check. `run-identity.json` records the
source commit, N0 commit, origin and run identity.

For prototype screenshots, set `NOTEBOOK_PROTOTYPE` to the extracted, hash-verified
final export directory. Keep all export files together. Add the following local
viewing wrapper as `reference-responsive.html` beside `Main.dc.html`; it changes
neither the supplied source nor its scripted behavior:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <script src="./vendor/react.js"></script>
    <script src="./vendor/react-dom.js"></script>
    <script src="./support.js"></script>
  </head>
  <body>
    <x-dc>
      <helmet
        ><style>
          body {
            margin: 0;
          }
        </style></helmet
      >
      <div style="width:100%;height:100vh">
        <dc-import
          name="Main"
          scenario="owen-p1-confused"
          start-at="top"
          labels="false"
        ></dc-import>
      </div>
    </x-dc>
    <script type="text/x-dc" data-dc-script>
      class Component extends DCLogic { renderVals() { return {}; } }
    </script>
  </body>
</html>
```

The fixed 1440px corrected-help artboard is captured separately, unchanged.
External prototype font requests are blocked; font fallback differences are
recorded rather than treated as application defects.

`native-zoom.mjs` starts two **new disposable headed browser profiles** with native
100%/200% zoom preferences and `viewport: null`. It verifies the known server's
response marker before interacting. It asserts doubled DPR, halved CSS viewport,
unchanged visual-viewport scale and no CSS zoom. This is native browser zoom,
not an emulated narrow viewport or pinch magnification. No user's browser profile
or security setting is read or changed. See Chromium's
[ChromeZoomLevelPrefs](https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc)
for the native preference. Profile directories remain in the ignored output
folder for local audit and must not be committed.

`--serve` starts only the independently verified preview. It prints the new origin;
it is not a production application server. Stop only that process when finished.

Screenshots and JSON reports are fixture-level evidence. Real StudySession,
reading acknowledgements, recovery, native mobile keyboards and screen readers
still require the existing owners' integrated acceptance.
