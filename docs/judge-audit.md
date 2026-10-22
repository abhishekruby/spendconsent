# Judge audit (22 Oct 2026)

Against the [official rules](https://paypalaihackathon.devpost.com/rules), checked
live on 22 Oct: 18,281 registrants; India is not excluded (section 3). Stage 1 is
pass/fail on theme fit and use of the required APIs/SDKs. Stage 2 has five equally
weighted criteria. Judges may score from the description, images and video alone
(section 5, Testing). Winning is never certain; scores below are our own estimate.

## Stage 1 checklist

| Requirement | Status |
| --- | --- |
| PayPal sandbox central + AI tool | Done (Orders v2 + JS SDK v6; local Qwen3-4B) |
| New work in submission period | Done (history in `docs/progress.md`) |
| Text description | Draft only (`docs/submission-draft.md`); rewrite |
| Judges can run it or a hosted demo | Partial: README needs Linux + Postgres + 3 GB model + own sandbox app |
| Public repo, OSS license visible in About | Repo private; MIT file present |
| Video < 3 min, public YouTube, shows it working | Not made |
| Test credentials / sandbox login for judges | Missing |
| No third-party trademarks/music in video | Plan for it |

## Stage 2 estimate (1–5)

| Criterion | Now | Why | What raises it |
| --- | --- | --- | --- |
| Technical | 4 | Server-side create/capture/read-back, state machine, 109 tests, 160/160 blind AI eval, MCP server, Channel3 | One-command Docker run; a second PayPal capability (owner-approved refund) |
| Design | 4 | Complete journey, receipt, owner link, sounds, light/dark | Judges must be able to touch it; mobile owner page polish |
| Impact | 2.5 | Fictional catalog, no users, problem argued not shown | Lead with the agentic-commerce trust problem; Channel3 real prices; public evidence; any real-person quotes |
| Innovation | 3 | Close to Google AP2 "cart mandate" (which PayPal supports) | Say it plainly: a working cart mandate on PayPal today, agent never holds payment power, server re-verifies |
| Presentation | 0 | No video yet | The single largest lever; judges may watch only this |

## Prize fit

Best Use of Agentic Commerce (MCP agent that can't pay), Best Use of PayPal + AI,
Best Demo Delivery (needs a great video), Channel3 ($1,500; real API calls in the
product). One honorable mention and one sponsor prize can be won together.

## Plan, in order

1. Video (script in `docs/demo-script.md`; user's voice, screen recording).
2. Devpost text rewritten around "a consent layer for AI shopping agents".
3. Docker one-command run; hosted demo only if a free host is confirmed without a card.
4. Judge test access: sandbox buyer login in the Devpost testing field.
5. Owner-approved refund (PayPal depth), if time remains.
6. Repo public, final test, submit by 10 Nov. Every public step needs the user's OK.
