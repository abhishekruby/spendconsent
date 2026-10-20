# Frontend checkpoint — 18 October 2026

The session-bound purchasing workspace was privately committed as `bfbb3c2`.
This checkpoint records the root agent's actual local-browser observations and
the frontend checks below. It does not establish a completed AI/payment journey
or full-project readiness. The shared [API contract](prebuild-audit.md#stable-api-contract-for-backendfrontend-agreement)
and [frontend design](frontend-design.md) remain the implementation references.

## Actual local-browser observations

- The root agent saved the sample cloth request, reference `b225775a`, as version
  1. Confirming requirements produced versions 2 and 3 of the same request:
  exactly 40 individual units, maximum $60.00 USD including delivery and tax,
  40 × 40 cm cloths, and one-time purchase only.
- The application returned HTTP 503 `MODEL_UNAVAILABLE`; GET read-back and
  browser refresh preserved the saved request and its confirmed requirements.
  The UI showed the unavailable model outcome without seeded comparison offers
  or a fabricated AI success.
- A clarification update that retained the same phase originally remounted the
  version-keyed form and left focus on the document body. Adding request version
  to the existing guarded heading-focus effect restored focus to the main H2
  after the update. Refresh and polling do not request heading focus.
- At a 320px viewport, the original document scroll width was 322px against a
  305px client width. Allowing the mobile stage labels to wrap and removing the
  body's fixed minimum width produced scroll/client widths of 305px/305px.
  At 360px, both widths were 345px. Stage labels and the current-step indicator
  remain present; the mobile header already allows wrapping.
- Keyboard checks covered the skip link and subsequent Tab navigation into the
  main form. The root agent also inspected the desktop dark-mode rendering;
  its local screenshot is `.runtime/frontend-desktop-review.jpg`, an ignored
  runtime artifact rather than a committed evidence image.

## Focus follow-up verified — 19 October 2026

The root agent observed that manually reloading saved status disabled the focused
reload button during its request and left focus on the document body afterward.
The focused button now uses `aria-disabled` while busy. Its existing `refresh()`
busy guard still rejects duplicate activations; the read-only GET flow and all
other controls are unchanged. Disabled styling also covers this semantic state.

After applying the reviewed backend migrations, the root agent repeated this
check in the actual local browser on 19 October. Clicking **Reload saved status**
completed with “Saved status reloaded” and left the same button focused. Pressing
Enter repeated the GET: the button exposed `aria-disabled` while busy and stayed
focused both during the request and after completion. The restored request
remained version 3 with the same confirmed requirements. Manual-reload focus
retention passed; no new request, payment attempt or financial action was created.

## Checks and limits

The existing Node test runner checks integer cents and pack arithmetic, typed API
boundaries, CSRF/session transport, safe errors, stale responses, request
recovery, financial action gates, escaped fixture rendering, and payment-state
announcements. Changed nonurgent payment states use the existing polite status;
unchanged polls stay quiet, and urgent unknown/manual-review states retain their
single alert. These payment states are covered with explicitly labeled test
fixtures, not real browser payment outcomes.

After the reload-button change, `npm test` passed all eight groups and
`npm run build` passed TypeScript and Vite production compilation. The existing
busy guard was not changed, so no new utility logic or dependency was introduced.

No actual AI comparison → review → approval browser happy path has passed.
PayPal SDK integration, checkout/capture controls and a real approved sandbox
payment journey are not verified by this frontend checkpoint. Financial controls
remain disabled, and no financial action was performed for these frontend
checks. Model readiness, backend integration, authorized sandbox verification
and measured usefulness remain separate project gates.

## Limited browser follow-up — 20 October 2026

Actual restored version-3 request in the default-off `MODEL_ERROR` state only:
all seven visible inputs had labels; landmarks/status semantics were present.
Keyboard navigation showed the 3px accent focus outline; Enter on the skip link
then Tab reached the first control within main. At 390×844 and 320×640 CSS-pixel
viewports, document content did not overflow horizontally. Visible form/buttons
were at least 44px high; the checkbox's whole label target was 45px high.

The rendered dark form boundary was only **2.48:1** against its background.
Changing the shared input/textarea/select border to the existing muted token
raised it to **8.60:1** (`#b2c5c6` on `#17272a`), verified from actual computed
styles. The light token pair calculates to **6.54:1** (`#4b6063` on `#fcfdfd`);
that pair was calculated from source, not a rendered light-theme audit.
Body/label/status text checked in the dark state exceeded 4.5:1.

This is limited browser/DOM evidence, not a complete WCAG audit or screen-reader
speech test. Actual AI comparison, review, approval, payment/recovery states,
SDK popup, 200% zoom and full assistive-technology behavior remain to verify.
