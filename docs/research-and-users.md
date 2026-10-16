# SpendConsent — research and target users

Checked: 16 October 2026. Working name. This is desk research and a proposed product definition, not evidence of market fit. The user authorized research, a PRD, and stack selection; product implementation has not been authorized.

## Research conclusion

Continue with a **small, buyer-facing purchasing assistant for routine business supplies** as the planning direction. It should do comparison work, then let the person approve an exact purchase. Test whether that is actually easier than a normal catalog and calculator. Do not position it as the invention of safe agent payments: close implementations already exist.

The most specific audience found in this research is an owner or administrator at a small service business buying consumables in different pack sizes. A cleaning business buying cloths and trash bags is a useful first scenario. The earlier notebook example becomes an additional test case, not a different product.

Evidence supports a problem class: inconsistent prices, confusing pack economics, and reluctance to trust AI purchases. It does **not** establish that this audience already uses PayPal heavily, that our app will save hours, or that customers will pay for it. Those remain material commercial risks.

## Evidence register

| Source | What it supports | Limitation and product consequence |
| --- | --- | --- |
| [Small-business supplies discussion](https://www.reddit.com/r/smallbusiness/comments/1qakae2/where_are_you_guys_actually_buying_supplies/), 12 January 2026 | A self-described cleaning-business owner reports inconsistent sourcing prices and disappointing unit costs for routine supplies. | One unverified public account. This is sourcing pain, not a request for our product or proof of PayPal use. Compare full delivered cost and pack sizes; do not claim to solve universal supplier discovery. |
| [AI shopping discussion](https://www.reddit.com/r/OpenAI/comments/1kfkt68/ai_shopping_what_have_you_bought_using_ai/), 5–6 May 2025 | Users describe stale prices, poor recommendations, and an unsuitable purchase. Other commenters describe useful comparison assistance. | Dated anecdotes with mixed outcomes. Ground recommendations in current catalog fields and show sources; do not claim all current assistants fail. |
| [Purchasing-agent trust discussion](https://www.reddit.com/r/AI_Agents/comments/1uj4afm/i_set_up_an_ai_shopping_agent_then_approved_every/), approximately July 2026 | The poster still checks price, pack size, and alternatives despite configuring an agent. | Consumer self-report, not a business survey. A review screen can preserve control but may add friction; measure the complete workflow, including review. |
| [PayPal merchant research](https://www.paypal.com/us/brc/article/agentic-commerce-pulse-report-findings), 27 April 2026 | PayPal-commissioned US research describes security, pricing accuracy, and checkout trust concerns. | Merchant-side research does not validate our buyer segment, commercial demand, or savings. Use as context rather than market sizing. |

No interviews, customer trials, paid databases, private community access, or outreach were used. Public posts can be mistaken, promotional, or unrepresentative. No prevalence, average loss, market-size estimate, or conversion rate is derived from them.

## Users and buying roles

These are design hypotheses, not interviewed personas. The proposed 2–20 person business size is a focus choice rather than a measured market boundary.

| Role | Situation and job | What they need from this product | Initial priority |
| --- | --- | --- | --- |
| Owner/operator of a small service business | Personally researches and buys recurring, low-risk consumables; may use a calculator, supplier sites, and saved product links. | A suitable cart with understandable pack quantities, full cost, and explicit approval. | Primary user and possible payer; start here. |
| Administrator buying for the owner | Receives an informal request and must avoid ordering the wrong specification or overspending. | Clarify requirements, compare matching options, and preserve the reviewed cart. | Secondary user; separate employee/manager accounts are deferred. |
| Connected merchant | Supplies product, availability, and checkout data. | Accurate representation and orders that match the checkout record. | Integration partner, not the initial customer or assumed payer. |
| Developer building purchasing agents | Wants reusable spending controls and evaluations. | SDK, integrations, operational guarantees. | Excluded from the first product; this is a different buyer and would change the PRD. |

**Primary job:** When I need routine supplies, help me compare suitable offers and prepare a complete purchase, so I can approve it without repeating all the research myself.

**Trigger:** replenishing a known supply or finding an acceptable pack size within a fixed budget. **Success:** correct specification and quantity, clear delivered cost, less active comparison work, and no unreviewed change reaching payment. **Current alternatives:** trusted repeat order, merchant search/filter/sort, spreadsheet/calculator, ordinary AI chat, or an existing purchasing platform.

Do not target high-risk equipment, chemicals, medical products, investment decisions, broad enterprise procurement, or unrestricted shopping across the web in version one. Users needing multiple currencies, many suppliers, negotiated contracts, credit terms, or offline inventory integration are outside this prototype.

## Competitive assessment

Published capabilities were inspected; no competitor account or hands-on trial was used. Missing information is not evidence of a missing feature.

| Alternative | Published positioning and mechanism | Competitive implication |
| --- | --- | --- |
| [Ramp Procurement](https://ramp.com/procurement/) | Business purchasing platform with natural-language intake, AI research, approvals, purchase orders, and virtual cards. | AI procurement and approval management already exist. Do not claim small teams lack alternatives or that all competing products require expensive enterprise contracts. |
| [alex-hahn/agentic-commerce](https://github.com/alex-hahn/agentic-commerce) | Open-source trust layer with exact-cart, expiring, single-use approval and separate human authority. | Very close technical overlap. Cart fingerprints, approval gates, and audit records are established ideas; our implementation would need its own useful buyer experience and evidence. |
| [Argus](https://devpost.com/software/argus-n507tw) | Hackathon payment guardian claiming intent checks, spending rules, scoped payment credentials, and an approval dashboard. | Substantial conceptual overlap. Its project page is self-reported and belongs to another competition; its claims and awards do not predict this hackathon. |
| [Agentic Shopping Autopilot](https://github.com/AndriiShramko/agentic-shopping-autopilot) | Published open-source purchasing workflow under a signed mandate, with actual-shop integrations claimed by its author. | Delegation plus purchasing permission is not a new category. We are not claiming universal merchant coverage or protocol compatibility. |
| [Skyfire](https://docs.skyfire.xyz/docs/introduction-to-skyfire) | Agent identity and token-based service payments with buyer/seller wallets. | Adjacent agent-payment infrastructure exists. Its current introductory page does not establish our exact physical-goods workflow; older spending-controls notes are not a fresh feature verification. |
| Normal catalog + calculator | Search, filters, explicit checkout, and arithmetic. | The most important practical baseline. If this is faster and sufficiently reliable, adding AI has not earned its cost or complexity. |

### Positioning to test

For a small-business buyer ordering routine supplies, SpendConsent prepares an evidence-backed cart with pack economics and protects that exact reviewed purchase through PayPal sandbox checkout.

The proposed specialization combines **understandable comparison** and **visible handling of changed terms**. Neither component is globally novel. We have not established that a competitor lacks this combination, or that a PayPal-specific implementation alone is sufficiently differentiated for an innovation prize.

The product should lead with the buyer outcome, not claims such as “unhackable agent wallet” or “first safe AI shopper.” A locally stored approval record is not a legally binding mandate, escrow, proof of merchant honesty, or an independent security certification.

## Opportunities, threats, and commercial test

**Opportunity hypothesis:** pack count, dimensions, availability, delivery charges, and tax create comparison work that can be made easier to review. A short, visually clear buyer workflow could be more approachable than a general procurement platform. Neither opportunity is validated.

**Main threats:** existing products already cover much of the concept; buyers may simply reorder known items; connecting enough real suppliers may be more work than the comparison saves; checkout approval may preserve most of the original effort; a small local model may be slow or unreliable.

Possible revenue later is a per-business subscription for repeated use. Do not set a validated price or charge a transaction fee in the prototype. A synthetic demonstration cannot establish willingness to pay, retention, acquisition cost, or investor interest.

The first catalog is one authorized sample merchant. That intentionally leaves cross-supplier sourcing unproven. If buyers only value comparisons across their existing suppliers, merchant access becomes a prerequisite for a commercial product, not a feature we can claim from this demo.

## Validation without merchant contacts

1. Assemble clearly labeled, fictional supply cases from the problem patterns above. Do not copy customer identities or private transaction details.
2. Compare the prototype with a normal catalog and calculator using equivalent cases. Include active review, errors, corrections, and model waiting time. Alternate task order to reduce learning effects.
3. Use independent expected answers for specifications, pack counts, and exact totals. The AI must not grade itself. Include ambiguous and impossible requests.
4. Check changed price, same-price item substitution, expired approval, duplicate submission, cancellation, and uncertain payment outcomes. Financial tests initially use local fakes. Real sandbox actions require explicit user approval.
5. Record results, including failures. A developer-run experiment demonstrates engineering feasibility only. Optional later usability sessions with unfamiliar volunteers need separate recruitment authorization; existing merchant contacts are not required to start.

Continue only if the workflow is understandable, correct, and faster on the selected tasks. If it fails, narrow or revise this direction; do not keep adding features to protect the idea.

## Organizer expectations

The [official rules](https://paypalaihackathon.devpost.com/rules) equally weight implementation, design, impact, innovation, and presentation. The proposed evidence for each is defined in the PRD. A working AI-to-reviewed-PayPal journey fits the theme; fit is not proof of novelty, market fit, or a prize. No source establishes a hidden preferred industry or a guaranteed winning project.

**Research decision:** proceed to a reviewable PRD and selected planning stack. Product implementation, publishing, and financial actions remain separate decisions.
