# Progress — project log

## Latest status — 16 October 2026: canonical folder and private GitHub setup

- User requested a professional project under Documents/Personal Project, a new GitHub repository, Codex Projects registration, complete project context/instructions, and an opinion on Django/PostgreSQL.
- Copied the complete lab to `/home/abhishek/Documents/personal-project/PayPal AI Hackathon 2026 — Project Lab`, reusing the existing personal-project parent. The original output folder was preserved. Private `.env` copied locally without displaying its contents and restricted to permissions 0600.
- Created private GitHub repository `https://github.com/abhishekruby/paypal-ai-hackathon-2026` under the active signed-in account. Visibility independently verified PRIVATE. Initial commit 2eaffed was pushed to main; the GitHub commits API returned the identical full SHA. Local main tracks origin/main. Pre-push checks covered the 25 explicitly selected files and confirmed private artifacts are excluded. Details are in docs/project-setup.md.
- Added root PROJECT_CONTEXT.md, a task-focused handoff including goals, proposed product/users, public evidence limits, discarded directions, verified PayPal setup, authorization boundaries, and reading order. Added docs/project-setup.md with prepared project instructions and the exact folder to attach.
- Revised the planning backend to Django 5.2 LTS + Django REST Framework + PostgreSQL after reviewing the user's question, existing framework experience, and read-only PostgreSQL readiness. Added docs/stack-review.md and aligned README, PRD, architecture, AGENTS, context, and tooling. React/Vite, PayPal sandbox, and the local-model feasibility gate remain the plan. No application or database role/schema has been created.
- Added an MIT license for original repository material. Git ignores actual environment files, credentials, database artifacts, model weights, logs, and the local sandbox screenshot. No public publication, paid service, deployment, outreach, or financial action was authorized/performed by this setup.
- Verification: offline diagnostic self-test passed with zero network calls; 19 Markdown documents passed local-link and code-fence checks; owner-only private configuration mode verified. Backend/frontend remain placeholders.
- Codex Projects registration is pending a user UI action: the exposed app tools cannot create a saved Project, the Linux CLI has no app launcher, and native app automation is unavailable. A prepared-folder registration request was sent while repository setup continued. Verify the saved path through list_projects after the user adds it. No private app database/settings workaround was used.

## Latest status — 16 October 2026: research, users, PRD, and stack

- User authorized research, user definition, a PRD, and technology selection for the current purchasing-assistant proposal. This authorizes planning and resolves the earlier instruction to defer framework selection; it does not authorize final product implementation or sandbox financial actions.
- Created docs/research-and-users.md. Rechecked official competition rules, PayPal merchant research, public shopping/supply complaints, and direct competitors including Ramp Procurement, Argus, and exact-cart approval repositories. Found a specific routine-supplies anecdote from a self-described small cleaning business. Public self-reports and vendor claims remain unverified; no market-fit, time-savings, PayPal-adoption, global-novelty, or prize-probability claim.
- Defined the proposed primary user as the owner/administrator buying routine low-risk consumables for a small service business. The first scenario compares pack sizes and full delivered costs. A single authorized sample merchant is the prototype boundary; cross-supplier sourcing and merchant coverage remain unresolved commercial requirements.
- Created docs/PRD.md with user journey, must-have scope, exclusions, exact-cart approval, changed-term handling, explicit human payment authority, idempotency/recovery requirements, metrics, feasibility gates, and a proposed under-three-minute demo. Targets are explicitly unmeasured.
- Replaced the generic architecture discussion with selected planning defaults: React/TypeScript/Vite, Python FastAPI/Pydantic/Uvicorn, SQLite, PayPal SDK v6/Orders v2, and local Ollama/Qwen3-1.7B. Inspected official implementation/license sources. No hosted inference, sponsor trial, or cloud service adopted.
- Read-only hardware inspection: i5-1035G1, 7.4 GiB RAM total, about 2.9 GiB available at inspection, MX250 with 2 GiB VRAM, about 55 GiB free disk. Ollama not found on PATH. The small model's download is listed at about 1.4 GB; runtime memory, speed, GPU suitability, and task reliability have not been benchmarked. The PRD requires a feasibility check before committing this inference choice to implementation.
- Updated README, AGENTS, ideas, and tooling so planning status and stack selection are consistent. Master zero-cost, sandbox, secret-handling, financial-approval, and publication/destructive-action boundaries are preserved.
- Documentation verification passed for seven edited/new documents: local links, code-fence balance, trailing whitespace, and fictional example totals. Backend and frontend contain only their existing .gitkeep files. No product code, dependency installation, model download, new account, payment, outreach, publication, or private .env access occurred.
- Next decision: review the proposed product scope; record agreement before implementing. First engineering gate after agreement is read-only local-model feasibility, followed by comparison/approval tests with fake payment responses. Actual sandbox financial testing requires separate explicit approval. Only the previously verified OAuth result is established today.

## Original setup log — 13 October 2026

## Completed

- Retrieved the referenced ChatGPT conversation. User messages confirm registration was reported and professional workspace setup was requested. Assistant messages are unresolved content-reference markers; no prior detailed folder specification could be recovered.
- Created the named local project lab with master instructions, requested documents, blank configuration, reserved backend/frontend folders, and a sandbox diagnostic. Product choice remains open.
- Inspected installed local developer tooling; no installations, paid services, or machine-security changes were necessary.
- Opened the existing PayPal Developer tab in the user's Chrome. User completed login. Verified the developer dashboard's sandbox mode and an existing Default Application.
- Prepared a dedicated Merchant sandbox app. User approved credential creation. PayPal rejected the requested app label because it contains “paypal”; permitted label: AI Hackathon 2026 Project Lab. Dedicated app creation is confirmed in Chrome.
- Reviewed official competition rules, schedule, FAQ, resource hub, REST quickstart, OAuth authentication, and AI toolkit. Saved source links and caveats.
- Documented five differentiated ideas, minimum demos, risks, and open questions. None selected.
- Diagnostic self-test passed with dummy credentials and zero network calls. Missing-credential preflight correctly stopped before any network request. Private blank .env prepared with permissions 0600.
- Initialized local Git on main; verified .env and private files are ignored and .env.example is shareable. No commit, remote, or publication.
- Saved a screenshot of sandbox mode and the dedicated app title, cropped before credentials: sandbox-app-created.jpg.

## Verification status

| Check | Status |
| --- | --- |
| Workspace structure and documents | Verified; all requested paths present |
| Diagnostic offline self-test | Passed; zero network calls |
| Developer login | Verified in Chrome |
| Sandbox mode | Verified in Chrome |
| Dedicated sandbox app | Created and verified in Chrome |
| Authenticated OAuth API test | Passed: HTTP 200; token received; lifetime 32400 seconds; token discarded |
| Product PayPal + AI flow | Deliberately not implemented before agreement |

## Next actions

1. Discuss the five candidate ideas with the user.
2. Validate the preferred audience, problem, and relevant API fixture feasibility.
3. Record explicit product agreement before choosing frameworks or implementing features.

## Decisions and constraints

Budget: zero. Environment: sandbox. No payment, destructive step, publication, or submission without approval. No credentials in code/logs. No final product selected. Existing setup work and research are authorized; money movement is not.

Devpost registration is user-reported from the earlier chat, not independently verified during this setup. Individual eligibility, specific API entitlements, AI free-tier access, and local model performance remain unverified.

## Authenticated sandbox evidence

- Checked: 13 October 2026, 17:02 IST. User confirmed credentials were saved privately.
- App: AI Hackathon 2026 Project Lab.
- Operation: POST https://api-m.sandbox.paypal.com/v1/oauth2/token, client_credentials grant.
- Result: HTTP 200; valid bearer token received; lifetime 32400 seconds.
- Token discarded after validation. No credential, token, Authorization header, or raw response recorded. No payment or business object created.
- This verifies authentication only; product integration and individual API entitlements remain untested.
- Setup, research, and brainstorming deliverables are complete. Product selection awaits agreement.

## Market research follow-up — 13 October 2026

- Reviewed earlier project notes.
- Compared all five ideas against competitor primary sources, market/problem evidence, official PayPal capabilities, and public hackathon project pages.
- Confirmed Paceline, EscrowEase, and PartDrop list this hackathon; the complete gallery is unpublished. No exclusivity or prize-probability claim made.
- Saved docs/market-research-and-ranking.md with rankings, competitor overlap, candidate refinements, examples, market limits, and validation gates.
- Conditional recommendation: ERP data-readiness + human acceptance + reviewed invoicing; alternate: repair-queue procurement. This is a recommendation, not an agreed product selection.
- No implementation, outreach, paid service, payment, or API mutation performed. Next step: discuss the refined top two directions and agree before building.

## New direction requested — organizer perspective

- User requested a different idea and an assessment based on organizer goals, real demand, and prize potential.
- Rechecked published goals and equal judging criteria; distinguished official requirements from inferred sponsor preferences.
- Saved docs/new-idea-product-recall-recovery.md: small-merchant product recall matching and reviewed PayPal refund/claim routing.
- Verified public CPSC recall data/API, recent concrete recall, refund-window limitations, and adjacent RecallOps/RecallRoute projects. No assertion that fewer contestants will select this topic.
- This is an additional hypothesis for discussion. Market fit, merchant access, zero-cost AI, and refund flow remain unverified. No product selected or built.

## PayPal-heavy operations evaluation — 13 October 2026

- User clarified that the objective is recurring, time-consuming work in businesses already heavily using PayPal, with measurable operating-cost or error reduction.
- Compared five operations: payout exceptions, paid-order state discrepancies, settlement/reconciliation exceptions, refund support, and subscription failure handling.
- Recorded native PayPal/WooCommerce capabilities and public overlap; no low-competition claim made.
- Saved docs/problem-evaluation-paypal-operations.md with problem template, evidence questions, savings calculation, validation experiment, and conditional research priorities.
- No final product chosen; actual customer volumes, baseline time/cost, willingness to pilot, and relevant API access remain unverified.

## Ambitious agentic workflow and all-sponsor review — 13 October 2026

- User clarified that previous back-office ideas did not match the desired ambition: substantial business workflow compression, fingertip convenience, meaningful agentic AI, market demand, and prize competitiveness.
- Reviewed all ten official sponsor pages, prize conditions, free/trial offers, and tool-fit constraints. No account signup or paid adoption.
- Compared customer-request-to-paid-order, procurement-to-purchase, and event-brief-to-bookings workflows. Confirmed direct current-competition overlap for generic procurement (AgentDeal).
- Saved docs/sponsor-review-and-agentic-business-shortlist.md. Conditional first hypothesis: a specification- and capacity-aware sales engineer for a narrow custom-product merchant segment. Existing Conexiom, OnPrintShop, InkSoft, and adjacent projects prevent a world-first claim.
- Days-to-minutes improvement and market fit remain untested. Final product choice and implementation remain on hold until agreement.

## User has no merchant contacts

- User clarified they do not know merchants for direct validation. Existing contacts must not be treated as a prerequisite or repeatedly requested.
- Recorded public-evidence screening, clearly labeled benchmark cases, and optional recruitment of strangers as the next evidence paths.
- No outreach authorized or sent. Product-market fit remains unproven; no final product agreement or implementation.

## Public-source prototype path — 13 October 2026

- User prefers deriving a prototype from already documented public problems rather than waiting for merchant interviews. Read “Redis” as Reddit in the context of public discussions; no Redis infrastructure change.
- Found and documented specific screenprinting/printing intake, outsourcing, and repeated-estimation discussions, including counterexamples where existing formulas/tools work.
- Updated project instructions so interviews are not a prototype prerequisite. Public anecdotes remain distinct from market-fit or PayPal-adoption evidence.
- Final product scope still requires agreement; no implementation, outreach, or payment performed.

## Printing assistant competitor review — 13 October 2026

- Found a close published commercial match: My Print Shop MIS advertises email-to-AI-quote with real apparel catalogs and shop pricing. Verified OnPrintShop's PayPal listing, capacity rules, and current v13.1 rush-order/quote features.
- Revised the broad printing-assistant recommendation downward for originality. Recorded the explicit revision and source comparison in docs/sponsor-review-and-agentic-business-shortlist.md.
- Proposed contradiction resolution and approval/payment/specification consistency only as a research hypothesis; no unsupported claim that competitors lack these capabilities.
- Prize assessment remains qualitative. No winning percentage, first-prize assurance, or market-fit claim; no product agreement or implementation.

## Different business requested — 13 October 2026

- User asked to move beyond the printing assistant toward a different business with stronger originality. Set the broad printing candidate aside without selecting a replacement.
- Screened group purchasing, surplus matching, and offcut-to-product workflows. Found direct existing products for group buying and generic AI surplus marketplaces; no claim those categories are new.
- Added a research-only candidate to docs/ideas.md: measured workshop leftovers plus approved templates and buyer needs become feasible limited product offers, with reviewed sandbox checkout and paid-order production planning.
- Documented closest overlaps (Woodplans.ai, KNOT, StowWorks, Circula, Queen of Raw), public anecdotal evidence, the narrow proposed difference, and missing demand/novelty evidence.
- No product implementation, account signup, payment, outreach, publication, or final choice.

## Problem-first research requested — 13 October 2026

- User rejected workshop-leftover proposals and reiterated the requirement: publicly reported real costs/time, a specific gap existing products do not adequately solve, simple useful scope, meaningful PayPal/AI, and relevant sponsor resources.
- Switched to public-complaint screening before ideation. Found supplier loss/price-change reports, software-trial frustrations, and merchant interruption/backlog problems. Checked direct competitor sources, including TestBox's historical marketplace and pivot; did not market these categories as new.
- Saved docs/public-problems-and-gap-screening.md with evidence, rejection reasons, a narrowly documented vacation-feature limitation, adjacent Gorgias/WooCommerce capabilities, and the unresolved commercial/differentiation questions.
- The interruption-plan concept is a discovery lead only; it may not match the user's ambition and is not established as unique. No candidate is declared market-fit or prize-winning. Product selection remains open; no implementation or financial/outreach action.

## Revised brief: organizer goals and new AI skills — 13 October 2026

- User requests deeper research into one or two ideas, organizer expectations, meaningful sponsor use, business impact, and exploration of new AI skills rather than optimizing for existing ERP comfort.
- Rechecked official goals, five equal criteria, requirements, sponsor pages, PayPal agentic services access limits, and unpublished gallery.
- Reviewed PayPal merchant research, public pricing/data-conflict complaints, controlled agent-security research, and direct competitors Ottom, Switchbench, AgentData, PayBench, Skyfire, Argus, and open-source commerce controls.
- Saved docs/two-finalists-and-organizer-fit.md. Leading hypothesis: CheckoutProof, focused on actual AI purchase attempts, reviewed data/configuration correction, and verified PayPal sandbox/order correctness. SpendConsent ranks second due to direct security/control overlap.
- This changes the prior Shop Emergency Assistant recommendation in response to the revised objective. No final product agreement, implementation, AI/sponsor adoption, payment, external test/repair, outreach, publication, or submission.

## Prize-focused recommendation correction — 16 October 2026

- User challenged CheckoutProof's value and prize competitiveness. Acknowledged that eligibility/technical interest did not establish strong impact or novelty, and withdrew it as the leading recommendation.
- Screened repair procurement, contractor change orders, and photo-to-spare-part generation against direct products; did not recommend them as new categories.
- Current proposal: SpendConsent, an actual buyer-controlled purchasing assistant with exact reviewed-cart enforcement before an authorized PayPal sandbox transaction. Preference is based on clarity of buyer benefit and central payment execution; no new commercial validation or superior winning odds are claimed.
- Rechecked PayPal merchant research, Argus, public commerce controls, and agentic API access requirements. Updated README, ideas, and two-finalist report to prevent stale CheckoutProof recommendations.
- No final product selection, runtime AI adoption, credentials exposure, business-object creation, financial action, external testing, outreach, publication, or submission.
