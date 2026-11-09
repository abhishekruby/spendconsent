# Five differentiated product candidates

Status: brainstorming only, 13 October 2026. Names are working labels. None is selected or implemented. Differentiation is a design hypothesis; market novelty and demand have not been validated. PayPal capabilities are grounded in the [official resources](https://paypalaihackathon.devpost.com/resources); each exact integration still needs a sandbox feasibility check.

## 1. Scope-to-Invoice: change-order assistant for freelancers

**Audience/problem:** independent designers and developers lose income when informal client messages expand a job without a clear revised bill.

**Meaningful AI:** compare an agreed scope with later messages, identify added deliverables, and produce a source-linked change-order proposal. The freelancer sets prices; the model cannot invent fees.

**Central PayPal role:** create a reviewed invoice draft, then reconcile its status through the API. Sending or settling invoices remains an approved later step.

**Differentiator:** evidence-backed scope changes and explicit client approval before billing, rather than generic invoice text generation.

**Smallest demo:** synthetic original brief + extra request → AI highlights changes → freelancer approves fixed line items → sandbox invoice draft visible → status retrieved.

**Value measure:** time to prepare an accurate change order and the number of ungrounded line items. **Risks:** ambiguous scope and low-quality extraction; show evidence and editable fields. **Cost route:** local inference or verified free quota; synthetic documents. **Key question:** do freelancers need help detecting changes, or mainly asking clients to pay?

## 2. AccessCheckout: purchase review for assistive technology users

**Audience/problem:** buyers using screen readers or struggling with dense checkout copy cannot easily confirm item, total, and terms.

**Meaningful AI:** turn a structured cart and merchant policy into a plain-language, question-answerable purchase summary with links to the source fields. Deterministic code owns totals.

**Central PayPal role:** approved sandbox Checkout for the exact reviewed cart, with a verified receipt/status view.

**Differentiator:** the buyer can ask “What will I pay, and what am I agreeing to?” before consent, with accessible keyboard and screen-reader controls throughout.

**Smallest demo:** three synthetic products → accessible AI explanation → explicit buyer review → PayPal sandbox approval/payment only after user authorization → confirmed result.

**Value measure:** task completion and errors in understanding total/terms. **Risks:** AI misstatement, accessibility gaps, approval-flow constraints. **Cost route:** static local catalog and local/free inference. **Key question:** which checkout task is actually hardest for the intended users?

## 3. ProofPack: dispute-evidence organizer for small sellers

**Audience/problem:** sellers waste time finding order, shipment, and customer-message evidence when a dispute arrives.

**Meaningful AI:** organize a timeline and cite supporting evidence, flag missing documents, and draft an explanation without fabricating delivery or customer statements.

**Central PayPal role:** retrieve a sandbox dispute's real status and evidence requirements; map the proposed package to that case. Submission is a separate reviewed action.

**Differentiator:** a completeness check with traceable claims and explicit uncertainty, rather than an automated “win your dispute” promise.

**Smallest demo:** one seeded sandbox dispute + synthetic evidence → API case retrieval → AI timeline → missing-proof warning → reviewed package export. A seeded dispute must be proven feasible before choosing this idea.

**Value measure:** evidence preparation time and unsupported claims. **Risks:** sandbox dispute creation/entitlement, private communications, source quality. **Cost route:** local synthetic files and local/free inference. **Key question:** can we obtain a realistic sandbox case without spending most of the hackathon on fixtures?

## 4. RefillWithConsent: purchasing assistant for repair shops

**Audience/problem:** small repair shops reorder the wrong consumables because part descriptions are inconsistent and jobs need different quantities.

**Meaningful AI:** map messy technician notes to a small verified parts catalog, ask about ambiguous compatibility, and explain why each item is needed.

**Central PayPal role:** sandbox order for a user-approved, deterministic cart. Hard budget, recipient, quantities, and currency limits precede any payment action.

**Differentiator:** compatibility uncertainty stops checkout; the assistant demonstrates constrained agentic commerce with an auditable review rather than open-ended shopping.

**Smallest demo:** repair note → candidate parts → missing-model clarification → fixed cart under cap → reviewed sandbox Checkout after approval.

**Value measure:** incorrect parts selected and time to assemble an order. **Risks:** incorrect compatibility and fake catalog matches; restrict to synthetic non-safety-critical supplies. **Cost route:** local catalog, no paid shopping API. **Key question:** what repair niche provides useful input complexity without requiring specialized safety advice?

## 5. MatchLedger: grant-condition tracker for community projects

**Audience/problem:** a community group must show how actual donations match a sponsor's approved categories, but receipts and project descriptions are messy.

**Meaningful AI:** classify project expenses against a supplied funding policy, cite relevant policy clauses, and flag ambiguous or ineligible descriptions for human review.

**Central PayPal role:** read verified sandbox donation/payment records and show which funds support which approved project category; optionally add a reviewed sandbox donation Checkout after authorization.

**Differentiator:** transparent condition tracking tied to payment evidence, rather than a generic donation page or AI fundraising copy.

**Smallest demo:** synthetic policy + project expenses + approved sandbox payment fixtures → verified statuses → AI category suggestions → reviewer correction → transparent allocation report.

**Value measure:** review time and misclassified expenses. **Risks:** interpreting conditions incorrectly, fixture setup, misleading claims of legal compliance. **Cost route:** local files/inference; avoid payouts and multi-party settlement in the first demo. **Key question:** can one real community organizer supply a non-sensitive example policy?

## Comparison for discussion

These are provisional engineering estimates, not tested facts or a ranking.

| Candidate | AI contribution | PayPal dependency | Main unknown | Narrow demo difficulty |
| --- | --- | --- | --- | --- |
| Scope-to-Invoice | Scope comparison with citations | Invoice draft + status | Demand and extraction accuracy | Lower |
| AccessCheckout | Plain-language contextual explanation | Checkout + confirmed receipt | Accessible approval flow | Medium |
| ProofPack | Evidence timeline/completeness | Actual dispute case | Sandbox fixture access | Higher |
| RefillWithConsent | Ambiguous note-to-catalog mapping | Reviewed cart/order | Compatibility truth | Medium |
| MatchLedger | Policy-grounded classification | Verified donation/payment records | Reliable fixtures and user need | Medium |

## Agreement needed before building

**Planning authorized, 16 October 2026:** the user requested research, target users, a PRD, and tech-stack selection for the current proposed direction. These deliverables are now docs/research-and-users.md, docs/PRD.md, and docs/architecture.md. SpendConsent is narrowed to routine-supply purchasing for a small-business buyer, using one sample merchant. Stack selection is authorized; final product implementation and financial actions are not. The older recommendations below remain research history rather than current decisions.

**Revised objective, 13 October 2026:** the user wants deeper organizer-led research, one or two candidates, and new authentic agentic-AI skills beyond current comfort. Current research recommendation: CheckoutProof, with SpendConsent as a weaker second candidate. See docs/two-finalists-and-organizer-fit.md for public evidence, direct competitors, narrow proposed differences, sponsor fit, and uncertainties. This supersedes the comfort-oriented Shop Emergency Assistant recommendation; no final choice is agreed.

**Update, 16 October 2026:** the preceding ranking is superseded. CheckoutProof is withdrawn as the main prize-focused recommendation because impact and differentiation are not established. The current proposal is a narrow SpendConsent buyer workflow with reviewed purchase permissions and actual sandbox verification, documented at the top of docs/two-finalists-and-organizer-fit.md. Existing control/security competitors remain a major limitation; no winning odds or global novelty is claimed. No product is agreed or built.

**Latest steering, 13 October 2026:** the user wants a different business after the close printing-assistant competitor was found. Set that broad candidate aside. The additional research candidate below is for discussion, not selected or authorized for implementation.

Use public problem evidence as the user's preferred prototype starting point; interviews are optional rather than a prerequisite. Record the agreed idea, rationale, exclusions, zero-cost AI choice, and first-demo acceptance criteria before building. Later research considered a printing-shop sales assistant, but a close commercial match now weakens that broad recommendation. See docs/sponsor-review-and-agentic-business-shortlist.md for the revised competitive assessment. The user has not selected or authorized a final product.

## Additional candidate: demand-backed products from workshop leftovers

**Status update:** the user rejected this direction because the overlap with existing products is too substantial. Do not carry it forward as the current recommendation.

Research date: 13 October 2026. Working description only; no final product name.

**Business:** software for small woodworking workshops that proposes feasible limited product batches from measured leftover materials, approved product templates, actual cost/capacity records, and customer requests. The merchant reviews the batch and publishes a limited offer; buyers approve PayPal sandbox checkout, and verified paid orders determine the production work list. This is an intended business workflow, not a claim that any market is empty.

**Public problem evidence:** [offcut management discussion](https://www.reddit.com/r/woodworking/comments/1hvseji/ideas_for_offcut_management/) describes difficulty managing leftover pieces. [A woodworking-shop discussion](https://www.reddit.com/r/woodworking/comments/1aguq8z/) describes recurring ash scraps and asks what to make from them. These are dated self-reports, not market-size, adoption, or willingness-to-pay evidence. Repurposing and selling offcuts already happen.

**Competition checked before recommendation:**

- [Woodplans.ai](https://woodplans.ai/) advertises AI plans based on available wood or offcuts, including cut lists and assembly instructions. AI suggesting what to build is already marketed.
- [KNOT](https://knot.woodknot.app/about) advertises stock/offcut records, parametric templates, cutting plans, and job economics.
- [StowWorks](https://stowworks.com/) advertises stock-aware nesting, assemblies, batch costing, reservation, and job-to-invoice tracking. Material feasibility and costing are existing capabilities.
- [Circula](https://circula.ai/) markets AI surplus-to-buyer matching; [Queen of Raw](https://www.queenofraw.com/recycle/index.html) markets deadstock management/trading. A generic AI scrap marketplace overlaps with existing categories.
- Group purchasing was also screened and set aside as a novelty-led recommendation: [MOQBuy](https://moqbuy.com/) and [MOQ Pools](https://www.moqpools.com/) already describe demand aggregation to reach supplier minimum quantities.

These are published claims rather than tested workflows or independently verified commercial traction. The inspected sources do not establish the absence of any competitor feature.

**Proposed gap to investigate:** material inventory and real buyer requirements drive the creation of a feasible, costed, limited product offer, with approved checkout and paid-demand-to-production linkage in one simple workflow. This differs in intended emphasis from selling raw surplus, generating hobby plans, or costing a predefined product. The exact combination was not established in the bounded sources checked; that does not prove global novelty. Existing tools may already cover it through features or integrations. Require a workflow comparison before an originality claim.

**Illustrative prototype:** load measured offcuts, three workshop-approved non-structural desk-accessory templates, labour/finishing costs, and a buyer brief. AI selects and explains candidate products; deterministic rules reject impossible cuts and compute feasible quantity and estimated contribution after stated costs. The merchant reviews the offer. An authorized sandbox purchase updates the remaining allocated material and paid production list. Remove a usable piece or increase finishing time: the product quantity or commercial recommendation must change, rather than remaining an attractive fictional proposal.

**Boundaries and value:** use manually verified measurements rather than assuming a photograph proves dimensions/species/condition. Approved templates and operator review establish production suitability. Do not generate machine-control instructions or claim product safety, sales, profitability, carbon savings, or five-minute physical production. Prototype target: reduce planning effort and demonstrate correct material/cost/payment consistency with labeled sample data. Customer acquisition and actual buyer demand remain unknown.

**Revenue hypothesis:** workshops pay a subscription if this consistently creates worthwhile sale opportunities with less planning effort. No price or willingness to pay is validated. Start with one merchant and direct merchant checkout; do not add marketplace payouts, pooled custody, or an escrow claim.

**Decision:** fresh candidate for discussion only. It aligns with the user's ERP experience and interest in business automation, but it is not established as unique, better than alternatives, market-fit, or prize-winning. No implementation, publishing, outreach, production, or money movement authorized by this research.
