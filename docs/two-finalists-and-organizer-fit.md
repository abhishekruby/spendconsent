# Two finalists and organizer fit

Research checked 13 October 2026. Proposal only; no final product selected or implemented. Working names are descriptive, not registered product names.

## Revision — 16 October 2026

The earlier ranking below is retained as research history, not the current decision. CheckoutProof has been withdrawn as the leading prize-focused recommendation: its innovation and customer-impact evidence did not justify that confidence. No winner, best-project claim, or prize probability is established.

The current recommendation is **SpendConsent**, an actual buyer-controlled purchasing assistant whose financial tools enforce a reviewed purchase permission. This changes the emphasis from a developer testing product to a direct buyer benefit: getting shopping work done while preventing the app's agent from making purchases outside the reviewed permission. The reason for preferring it now is a clearer customer outcome and essential PayPal execution, not newly proven market fit or a newly discovered empty category. Its previously documented competitor overlap remains a major weakness.

### Narrow proposed prototype

A small business asks for ten A5 notebooks within a total budget, from an approved merchant, with no recurring purchase. A real AI agent searches a small merchant-owned catalog, asks about ambiguity, and prepares a candidate cart. A person reviews the exact merchant, item identifiers, quantities, currency, full total, and purchase terms. The payment tool checks the final cart against that approved version and permits only an unchanged, explicitly approved sandbox purchase. Changed terms require fresh review. The buyer gets a clear reason when a purchase is blocked.

Demonstrate one approved legitimate sandbox journey, one changed-price or changed-item case, and one controlled merchant-text instruction attempting to change the purchase. The model never receives PayPal secrets or authority to bypass the checking tool. Only scoped tests on our authorized sample merchant are proposed. This does not block purchases made outside the application, establish seller honesty, guarantee delivery, or prove comprehensive prompt-injection resistance.

**Meaningful AI:** interpret the business need, compare offers from authoritative catalog data, ask necessary questions, and choose tool steps. **Meaningful PayPal:** create and verify the reviewed sandbox transaction after the server-side permission checks. Code, not model judgment, enforces exact financial and identity limits. Every actual sandbox financial action still needs the user's explicit approval under the lab instructions.

### Evidence and competition rechecked

[PayPal's merchant research](https://www.paypal.com/us/brc/article/agentic-commerce-pulse-report-findings) describes concerns around AI pricing mistakes, security, and trust at checkout. This supports the problem class; it does not establish buyer demand for our app or quantify avoidable losses.

[Argus](https://devpost.com/software/argus-n507tw) and the [alex-hahn agentic-commerce repository](https://github.com/alex-hahn/agentic-commerce) remain close overlaps. The earlier Skyfire controls evidence remains relevant; a direct page fetch failed during this check. Do not call spending permissions, approval records, or agent safety new inventions. Our proposed narrow PayPal workflow must be demonstrated and compared; existing projects may already cover it adequately.

Additional candidate screening found direct competitors for AI repair-parts procurement ([Orderly](https://myorderly.com/), [Yaxle](https://yaxle.com/)), AI contractor changes ([ChangeMint](https://www.nolote.com/products/changemint/), [Banamind](https://banamind.ai/ai-for-renovation)), and photo-to-replacement-part CAD ([SliceFoundry](https://slicefoundry.com/replacement-part-generator)). These concepts were not recommended as unserved markets.

**Proposed business buyer:** teams building purchasing agents or small-business purchasing users. Which buyer would actually pay, and whether a library or an end-user app is the stronger product, remain unvalidated. Potential usefulness and thematic fit are not commercial proof.

**Sponsor fit:** PayPal is central; KERNEL is optional for authorized merchant browser interactions; AG Grid can show permitted purchases, changes, and decisions; APIMatic/Postman can support development and integration checks. Channel3 is optional only if product coverage and access justify it. No tool or account has been adopted. Runtime AI, free quotas, trial expiry, and judging access still need checks before implementation.

**Current decision:** recommend this bounded buyer workflow for discussion, with explicit competitor and impact limitations. Do not call it the best possible entry or a likely winner. No final product agreement, implementation, payment, outreach, or publication.

## Recommendation for the user's revised objective

Prioritize **CheckoutProof: an AI purchase tester and diagnosis tool for merchants and ecommerce agencies**. Keep **SpendConsent: a buyer's AI purchase-permission gate** as the second candidate, with a weaker differentiation case. This is a qualitative research ranking, not a probability of prizes or an assertion of product-market fit.

The user explicitly wants to explore new AI skills and build a more innovative business product. This supersedes the earlier recommendation optimized for familiar ERP work. The Shop Emergency Assistant remains unselected and is no longer the main recommendation for this revised objective. Printing and workshop-leftover proposals remain set aside.

## What the organizer actually publishes

The [PayPal launch post](https://developer.paypal.com/community/blog/PayPal_AI_Hackathon/) specifies no preset problem statements or industry tracks. Meaningful PayPal and AI are the central requirement. Sponsors supply resources; their involvement does not imply a hidden demand for a particular business idea.

The [rules](https://paypalaihackathon.devpost.com/rules) equally score implementation, design, potential impact, innovation, and presentation. Submission requires an executable prototype, a public licensed source repository, and an English public video under three minutes. Deadline: 12 November 2026 at noon Pacific; judging ends 15 December. First prize is $12,000. Five $5,000 honorable mentions include PayPal + AI and agentic commerce. A project can receive one grand-or-honorable prize and one sponsor prize.

**Inference from those requirements:** aim for an understandable business outcome, actual agent decisions, and an essential payment integration demonstrated end to end. Neither a large feature list nor many agents is evidence of quality. Sponsor adoption alone is insufficient.

[PayPal's merchant research](https://www.paypal.com/us/brc/article/agentic-commerce-pulse-report-findings) reports concerns around AI pricing errors, data security, product data readiness, and checkout integration. It also describes small merchants' limited time and technical expertise. This is PayPal-commissioned U.S. merchant research, not proof of worldwide demand or demand for our specific product. Avoid importing its forecasts or percentages as independently established market size.

## Public problem evidence

- [May 2025 shopping discussion](https://www.reddit.com/r/OpenAI/comments/1kfkt68/ai_shopping_what_have_you_bought_using_ai/): a consumer reports wrong prices, poor links, and recommendations that create more work. Anecdotal, dated, and not a merchant cost estimate.
- [August 2026 product-data discussion](https://www.reddit.com/r/GEO_optimization/comments/1vpgb0d/valid_schema_can_still_leave_an_ai_shopping_agent/): an auditor describes valid schema with conflicting visible price/feed price, in-stock markup versus sold-out inventory, and general versus item-specific return policies. A practitioner account, potentially commercially motivated; not independent prevalence data.
- [Merchant plugin repair repository](https://github.com/headwalluk/woocommerce-paypal-payments-fixes): its author reports a client's storefront returning errors and documents a product-resolution guard patch. This supports the existence of integration failures, not the claim that the particular bug remains unpatched upstream or our proposed tool would fix it.
- [Guardio's Scamlexity research](https://site.guard.io/labs/scamlexity-we-put-agentic-ai-browsers-to-the-test-they-clicked-they-paid-they-failed): controlled 2025 experiments describe an agentic browser interacting with a deceptive store and other attacks. These are historical experiments by a security vendor, not current failure rates for every agent. Do not repeat attacks against real third-party systems.

The evidence supports a real class of correctness/trust problems. It does not establish average hours lost, dollars recoverable, willingness to pay, or that existing tools fail to address them. No fabricated days-to-minutes baseline or sales improvement is justified.

## Finalist 1: CheckoutProof

### The product in one sentence

An ecommerce agency or merchant asks an AI tester to attempt a purchase on an authorized staging store; the tool explains what failed, proposes a small correction for review, and reruns the purchase through actual PayPal sandbox to check that the resulting order matches the customer's request and the approved merchant facts.

### Concrete illustrative demonstration

A fictional buyer requests a black backpack within a total budget. The visible page, catalog, and cart disagree about the selected variant or shipping charge. A real model-driven buyer follows the store's tools or browser flow. CheckoutProof records the attempt, identifies the mismatch with source evidence, and proposes a narrowly scoped configuration/data correction.

The operator approves the correction. The same request and an unseen related case are rerun. An explicitly approved sandbox purchase completes. The report compares requested variant, merchant-authorized totals, PayPal transaction state, and merchant order state. A successful payment with the wrong item or amount is still a failed test.

Injected error and catalog records must be labeled sample data. The model calls actual tools; no prerecorded model output is presented as live reasoning. PayPal sandbox calls must be real and described as simulated money. No live transactions, external store changes, or autonomous production repairs.

### Meaningful AI and PayPal

AI interprets ordinary buyer requests, chooses investigative steps, handles ambiguity, and explains the failure using retrieved evidence. It can propose the smallest correction but cannot invent the correct price or establish its own grading truth.

Deterministic checks compare exact money, currency, item/variant identifiers, payment state, and order state against a human-approved scenario. Models are not allowed to grade their own success from a persuasive explanation. Standard scripted tests remain appropriate for fixed invariants; AI is justified for varied requests and adaptive navigation/diagnosis.

PayPal is the payment system under test. [Orders v2](https://developer.paypal.com/docs/api/orders/v2/) and the [Agent Toolkit](https://github.com/paypal/agent-toolkit) are starting references. Specific operations and entitlements remain untested beyond the lab's successful OAuth authentication. Product testing needs additional approval for sandbox money operations.

Do not depend on instant access to Store Sync or Agent Ready. Their [official overview](https://developer.paypal.com/agentic-commerce-services/about/) says merchants must request access and undergo onboarding. A standard sandbox integration plus a merchant-owned sample storefront is the initial route.

### Competitors checked before this recommendation

| Source | Published scope | Consequence for our scope |
| --- | --- | --- |
| [Ottom](https://ottom.io/) | Runs shopping agents through storefront journeys, reports evidence and fixes, and monitors data/readiness. Its FAQ explicitly stops at the payment step without placing orders. | Basic agent readiness scanning is already a product. Our proposed distinction must demonstrate corrected merchant data/configuration and actual sandbox transaction/order correctness. |
| [Switchbench](https://switchbench.com/switchbench) | Synthetic payment scenarios, regression checks, replayable evidence, and human review for agent-generated changes. Early access/waitlist as checked. | Payment testing and evidence are existing categories. Connecting actual PayPal sandbox and the shopper's selected item is a proposed specialization, not a world-first claim. |
| [AgentData.shop](https://agentdata.shop/) | Commerce test APIs for search, cart, checkout, and evaluation, with real/demo data products. Advertised beta. | A fake shop or agent benchmark alone is insufficient differentiation. |
| [PayBench](https://paybench.org/) | Simulated commercial-autonomy cases around budgets, policies, and unsafe agent behavior; no published leaderboard results as checked. | Generic agent-payment benchmark construction already overlaps. |
| [Sales Agent Harness](https://github.com/agentic-commerce-lab/sales-agent-harness) | Merchant-owned controls and actual agent runtime for discovery, cart, and checkout handoff, including a policy-enabled research completion path. | Controlled seller-agent infrastructure exists. We would test merchant outcome correctness rather than claim to invent seller controls. |

Only published claims were assessed. No competitor trial was executed. These comparisons support a bounded positioning hypothesis; they do not prove that no competitor supports the full workflow or that adding PayPal alone yields sufficient novelty.

### Business model and measurable value

Initial buyer hypothesis: agencies already maintaining merchant integrations. They can use the tool after a catalog, theme, or checkout change. Paid scans or per-store monitoring are possible business models, with no validated price.

Measure correct issue identification, false alarms, recovery on unseen cases, active review/debug time, and mismatch detection after payment. A five-minute diagnostic run is an experimental target for a small prepared staging store, not a promise about onboarding, human approval waits, all websites, or production fixes.

The commercial case fails if ordinary scripted tests already solve the selected cases at less cost, connecting the store requires excessive custom work, or buyers do not value the proposed sandbox/repair depth. The AI must earn its role.

### New skills the user would explore

Actual model-driven tool use, browser agents where appropriate, evidence retrieval, structured outputs, agent evaluation, adversarial and changing-data cases, precise financial invariants, and reproducible traces. Start with one buyer agent and one diagnosis responsibility; they may share a runtime. Agent count is not a judging objective.

### Smallest scope worth building after agreement

One authorized sample storefront, a small verified catalog, a short scenario suite, actual AI attempts, grounded explanations, one reviewed reversible data/configuration correction, and an approved real sandbox purchase followed by verification. The first implementation should not be a general code-editing agent or a universal ecommerce-platform connector.

## Finalist 2: SpendConsent

### The product in one sentence

A business gives its buying agent a clear permitted purchase; before checkout, the application compares the final merchant, item, currency, full total, and recurring terms with that permission and routes changes to human approval.

Illustrative case: an item advertised at $40 becomes $55 with shipping, or a page adds an unwanted subscription. AI identifies semantic uncertainty; deterministic enforcement prevents a purchase outside the approved bounds. An authorized unchanged purchase proceeds through sandbox.

### Evidence and competition

Guardio's experiments illustrate a trust problem. However, [Skyfire's payment rules](https://docs.skyfire.xyz/docs/features) already cover agent spend controls. [Argus](https://devpost.com/software/argus-n507tw) describes shopping-agent seller/injection/intent evaluations and an audit trail; it lists another 2026 hackathon, not this PayPal competition. The [alex-hahn commerce repository](https://github.com/alex-hahn/agentic-commerce) advertises controls separating agent shopping from spending authority, including human approval.

Budget caps, allowlists, prompt-injection detection, approvals, and audit trails must not be presented as inventions. A narrow PayPal approval-to-final-cart comparison could be implemented, but its novelty case is weaker than finalist 1 and its commercial trust burden is higher. I do not recommend this as the leading choice.

## Relative assessment under the judging criteria

These are anticipated opportunities and risks, not scores for a built product.

| Equal-weight criterion | CheckoutProof | SpendConsent |
| --- | --- | --- |
| Implementation | Real adaptive AI attempts plus actual payment/order verification can show depth | Strong controls possible, but easily reduced to familiar policy checks |
| Design | One clear failure-to-corrected-result journey | Clear approve/block experience |
| Impact | Defined recurring agency workflow; savings and willingness to pay unmeasured | Broad relevant concern; deployment trust and access remain hard |
| Innovation | Test, reviewed correction, and verified sandbox outcome are a proposed focused distinction | Substantial direct overlap in controls/security |
| Presentation | Visible before/after counterexample and transaction evidence | Visible prevented mistake, though a familiar safety demo |

CheckoutProof is my leading hypothesis for this revised brief. It has a stronger demonstrable story and learning opportunity, not proven higher winning odds.

## Sponsor tools: use only where they earn their place

| Resource | Proposed role | Adoption boundary |
| --- | --- | --- |
| [PayPal](https://developer.paypal.com/) | Actual sandbox orders/payment results under test | Essential; never live, money steps require explicit approval |
| [KERNEL](https://paypalaihackathon.devpost.com/details/kernel) | Browser execution/replay on the authorized staging store | Useful if browser navigation is needed; advertised $50 credits do not cover model inference automatically |
| [AG Grid / Studio](https://paypalaihackathon.devpost.com/details/aggrid) | Scenario results, requested/observed differences, evidence views | Page favors polished Studio widgets/agent integration. Community can provide a free grid; Studio advertises a 45-day trial. Verify judging access before adoption. |
| [APIMatic](https://paypalaihackathon.devpost.com/details/apimatic) | PayPal API context during development | Does not supply the runtime AI model |
| [Postman](https://paypalaihackathon.devpost.com/details/postman) | Repeatable integration requests/checks | Useful validation resource; not necessary to run the product |
| [Elastic](https://paypalaihackathon.devpost.com/details/elastic) | Retrieve policy/catalog/log evidence if volume warrants it | Optional; start with simpler local retrieval. A trial is not permanent zero-cost hosting. |
| [Astropods](https://paypalaihackathon.devpost.com/details/astropods) | Optional agent runtime/monitoring | Quota/model costs unverified; no adoption assumed |
| [Render](https://paypalaihackathon.devpost.com/details/render) | Optional hosting and workflow execution | Deployment requires authorization and verified no-overage route |
| [Channel3](https://paypalaihackathon.devpost.com/details/channel3) | Optional external catalog cases | No need in initial verified merchant catalog; extra API calls are not extra customer value |
| [Bryntum](https://paypalaihackathon.devpost.com/details/bryntum) | Optional replay timeline if it improves understanding | Scheduling is not the product's core; 45-day trial limitation remains |
| [Zapier](https://paypalaihackathon.devpost.com/details/zapier) | Optional later approved deployment-event triggers | Not needed for the first flow; check free-plan feature persistence |

No sponsor signup, billing, trial activation, or integration was performed. Offers and quotas need a final adoption check. Starting a 45-day trial on 13 October ends before December judging; do not assume an extension. A free/local inference option still needs capability, licensing, privacy, and resource checks. Sponsor infrastructure credits and API-context tools do not by themselves fund model calls. Zero-cost remains a requirement.

## What improves the entry's competitiveness

After scope agreement, first prove one genuine AI attempt and one authorized sandbox journey. Then demonstrate a relevant failure, a reviewed correction, and a passing unseen case. Show evidence and limitations directly. Use a clearly labeled benchmark suite with correct expected outcomes, including negative cases, and report measured results without inventing customer savings. Keep the final video's story understandable within the required time.

The product must remain usable during judging. A short polished story and correct implementation across the five criteria are more useful than extra features or sponsor logos. This is an execution strategy inferred from published rules, not inside knowledge of judges.

The [complete gallery](https://paypalaihackathon.devpost.com/project-gallery) remains unpublished. Participant registrations are not final project counts. No winning percentage, first-prize assurance, exclusivity claim, or investor interest can be inferred.

## Decision

Recommend CheckoutProof for the next product discussion. Neither finalist is agreed or built. Before implementation, record the user's agreement, the exact test-store scope, the initial AI route, and first-flow acceptance criteria. No outreach, financial action, external store testing/repair, publication, or submission is authorized by this report.
