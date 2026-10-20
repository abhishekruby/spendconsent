# SpendConsent local workspace

This React/TypeScript application uses the actual session-bound Django API. It
contains no runtime seeded offers, fake model results or fake payment successes.
Default startup saves requests and responds honestly with `MODEL_UNAVAILABLE`;
the UI reads the saved request after that response and after browser refresh.

With the project backend listening on `127.0.0.1:8000`:

```sh
cd frontend
npm ci --ignore-scripts --no-fund --no-audit
npm test
npm run build
npm run dev
```

On ordinary starts, reuse the existing dependencies (keep the backend running
separately):

```sh
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the backend without changing
the browser origin. The backend must allow that exact local host/origin and
enforce anonymous session CSRF. The dev server binds loopback with a strict port:
it fails if occupied rather than stopping another service or choosing a port.
There are no `VITE_` secrets or environment files to create.

React/React DOM 19.3.1, Vite 8.3.4 and their type packages 19.3.0 are MIT;
TypeScript 7.0.2 is Apache-2.0. Exact direct versions, Vite's Node engine range
(`^20.19.0 || >=22.12.0`) and licenses were checked through the primary npm
registry on 18 October 2026. Installed Node 22.14.0 satisfies that range. The lock
file records transitive packages. No hosted service, paid kit or remote font is
used. Vite's built-in JSX transform avoids an additional React plugin.

`npm test` compiles the API and presentation helpers, then uses Node's built-in
test runner for cents/pack math, boundary validation, session/CSRF headers, safe
error handling, request recovery, stale responses and financial action gates.
The clearly labeled test-only fixtures also render comparison, exact review and
uncertain/mismatched outcomes through React server rendering. They are never
imported by the running application. Build/test success is not browser or actual
AI/payment integration evidence.

Payment capabilities default off. The SDK loads only for a permitted saved
attempt. Runtime configuration and exact action-time human permission are both
required before any real order/capture. Review and app approval are direct
human UI actions. Once all gates permit it, the UI starts only the reviewed cart,
opens its existing order in the SDK, and asks the server to capture/verify it.
Existing attempts expose only server-permitted actions; bounded automatic checks
use GET only. A stop cannot undo a dispatched operation. Actual SDK/financial
compatibility and the complete buyer journey remain unverified.
