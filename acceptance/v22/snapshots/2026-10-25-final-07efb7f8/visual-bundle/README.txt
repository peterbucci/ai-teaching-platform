Prepared verification-only visual bundle. No browser execution was performed during preparation.

Origin: http://localhost:3396
Candidate: 07efb7f821339538800f150f57b298eb2e606be3
Tree: 948b9a6005a056c97f10d181c589b5352d6221f3

Reuse: PR122 capture-shell geometry/capture pattern and shell-accessibility-browser native Edge Preferences method. Safety module is loaded byte-for-byte at reviewed SHA256 af01b05dd317682a47b6ec64acc5083cae1430383d697dcb1ede53687722c485. Each program owns the existing global acceptance lock for its full run and checks the 10 GiB runtime preflight before each state. Run sequentially, after other guarded runtime work releases ownership. Do not wrap with another lock-owning wrapper.

Commands (replace out paths with fresh directories):
node capture-prototype.mjs <runtime-final> <fresh-prototype-out> <final-bundle/safety.mjs> <actual-export-directory>
node capture-application.mjs <runtime-final> <fresh-application-out> <final-bundle/safety.mjs> <filled-scenario.json>
node build-gallery.mjs <application-out/report.json> <prototype-out/report.json> <new-gallery.html> [visual-review.json]

The gallery generator validates image hashes and preserves raw files. Optional visual-review.json maps each state name to {"classification":"Accepted|Accepted with documented deviations|Changes required|Not verified","reason":"specific inspected finding"}. It defaults every surface to Not verified. It never infers acceptance from screenshot existence or absent overflow.

Prototype script serves the exact unchanged original export on a temporary random loopback port. It uses actual visible controls and no internal prototype-state mutation. It captures all requested corresponding surfaces, objectives and questions separately, plus the prototype student work log. Learning insights has no exact prototype route, so the concern workspace is explicitly marked only as the corresponding capability comparison. Local source lines defined all navigation locators; first runtime execution may expose verifier selector faults, which must remain preserved before creating any separate corrected run.

Application scenario: copy application-scenario-template.json to a new file and fill objective, question, publication and saved intervention URLs from the new candidate's actual journey receipts. Null URLs intentionally remain UNRUN. Never insert old snapshot IDs or invent equivalent counts/lifecycle. Optional read-only actions can open a visible button/tab/summary by exact accessible name. Mutation requests are blocked after one authorized Demo teacher login per context.

Each script captures 1440x1000, 1024x768, 390x844 and 320x844 CSS viewports. It then launches isolated native100/native200 profiles with viewport:null and 1440x1000 browser window. DPR doubling, CSS width halving, matching outerWidth, visualViewportScale=1 and root CSS zoom=1 are all required before native200 captures run. Profiles are stored in runtime-final/private-visual-profiles and must NEVER be published.

Native200 includes the ordinary viewport PNG and a raw CDP visible-surface PNG. No images are resized/cropped/edited. Both pixel dimensions and hashes are recorded. Inspect native PNGs for crop or blank output before claiming complete visual capture; passing native zoom measurements alone does not prove screenshot completeness. Report screenshots exactly as obtained.

Gallery native200 selection now prefers the original CDP surface when its pixel dimensions equal measured innerWidth/innerHeight × devicePixelRatio and read-only PNG decoding establishes nonblank pixels. It retains the ordinary PNG as a link explicitly labeled Cropped ordinary capture when smaller. This detects blank/dimension problems only; it never establishes design fidelity. Initial real-file verification: prototype overview ordinary 708×454 and CDP 1416×908 both nonblank; root visually confirmed the CDP has the complete surface and bottom navigation. No PNG bytes changed.

capture-prototype-objectives.mjs is an objectives-only supplemental run at all required sizes, with the same arguments and guard. It targets the exact S1 outline span and verifies Store-and-forward editor fields. Keep prototype-captures-01 selector failures and use a fresh output path. See objectives-supplement-preparation.json for source and helper provenance.

This bundle performs no saves, publication, assignment activation, intervention approval/delivery, provider calls, SQL mutations, or application code edits. It verifies geometry/visible content only; parent browser workflow and database receipts establish persistence and authorization.
