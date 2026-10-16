# Public problems and gap screening

Checked 13 October 2026. Research only; no final selection or implementation.

## User's actual standard

Start with public reports of a costly or time-consuming headache. Check the closest products before recommending a solution. A different industry, an AI label, or PayPal checkout does not establish originality. The user has rejected the broad printing assistant and workshop-leftover concepts. Earlier administrative/recovery concepts also failed to match the user's ambition, so an adjacent concept must not be treated as an accepted replacement.

Public complaints can establish that an individual experienced a problem. They do not establish prevalence, a current unresolved market gap, an average cost, willingness to pay, or a prize probability. Vendor capability pages show advertised features; they do not prove the quality of those features. Silence about a feature is not evidence that it is absent.

## Evidence checked before ideation

| Problem and public report | Evidence of time/cost | Closest solution found | Screening decision |
| --- | --- | --- | --- |
| [Retailer repeatedly receives wrong/damaged goods](https://www.reddit.com/r/smallbusiness/comments/1od155e/keep_picking_terrible_suppliers_and_starting_to/) | October 2025 poster describes extensive supplier research and about $1,100 spent on a delayed, mostly unsatisfactory shipment. Self-report only. | [Sauda](https://getsauda.com/) markets AI supplier sourcing; [PartDrop](https://devpost.com/software/partdrop) describes inspection/payment gating. | Do not propose another generic sourcing or inspection agent. AI cannot establish actual goods quality from supplier promises. |
| [Supplier raises the invoice after payment](https://www.reddit.com/r/smallbusiness/comments/10jyinb/) | January 2023 report says the revised invoice was over $300 higher. No current frequency or hours estimate. | [Blag Check](https://blagcheck.com/) markets quote/invoice comparison and discrepancy explanation; [InvoRec](https://www.invorec.com/) markets invoice-to-agreed-reference checking. | Reject a generic AI quote/invoice discrepancy checker as a novelty-led recommendation. |
| [Business owners struggle to evaluate software](https://www.reddit.com/r/smallbusiness/comments/1kqcaws/) | May 2025 discussion: a commenter reports hours spent in trials; original poster requests independent advice and expresses willingness to pay a human advisor. Not willingness to pay our software. | [TestBox buyer sandboxes](https://www.testbox.com/platform/buyer-sandboxes) offer hands-on trials with synthetic data and an AI copilot; [Red Pill Labs](https://www.redpilllabs.com/software-selection) offers independent selection advice. | Do not claim software evaluation is unserved. |
| [Trial hopping and manual operations](https://www.reddit.com/r/smallbusiness/comments/1r13yu4/marketing_automation_software_for_small_business/) | February 2026 owner says manual reminders consume much of the week and wants to avoid weeks of trials. Statements are informal, not measured baselines. | TestBox's [own pivot account](https://www.testbox.com/post/pivoting-your-product) describes its former side-by-side software marketplace and partnership/revenue difficulties. | Reject rebranding that previous business model as new; an autonomous test-and-purchase variant would still need a demonstrated difference. |
| Customer not ready for installation | No strong matched independent public report with quantified cost recovered in this pass. | [InstallCue](https://installcue.com/) explicitly offers customer self-surveys, thresholds, photos, and blocker review before dispatch. | Reject generic pre-installation readiness as a new category. |
| [Seller's illness leaves paid orders/refunds unresolved](https://www.reddit.com/r/EtsySellers/comments/1cvuzya/) | May 2024 owner describes falling behind, believing a refund completed, and discovering the unresolved order after the platform refund window. No measured labour cost. | [Etsy vacation mode](https://help.etsy.com/hc/en-us/articles/115015662947-How-to-Manage-Vacation-Mode-for-Your-Shop), [Magical Vacations](https://www.magicalapps.com/faqs/what-should-i-do-with-my-existing-orders-before-using-magical-vacations), [WooCommerce Store Vacation](https://woocommerce.com/document/store-vacation/), and [Gorgias custom AI actions](https://helpcenter.gorgias.com/en-US/create-actions-use-advanced-options-to-build-custom-actions-for-ai-agent-1060364). | Documented limitation in vacation tools, but substantial adjacent support automation. Discovery candidate only, not an established unique product. |

### A concrete documented limitation

Etsy's current documentation says vacation mode stops incoming orders while the seller remains responsible for existing orders, cases, and messages. Magical Apps similarly leaves existing-order decisions to the merchant and says its theme-level hiding of purchase buttons does not stop every checkout route. This establishes a limitation in those features, not in all ecommerce software.

WooCommerce Store Vacation offers closure schedules, force-close operations, reporting, and programmatic abilities suitable for AI/automation clients. Do not claim that store-closing automation itself is new. Gorgias offers order/support actions and custom HTTP integrations. Do not claim that AI cancellation, refund support, or customer messaging is new or unavailable through configuration.

## Discovery candidate: an approved interruption plan for paid customer commitments

This is the most concrete feature limitation recovered in this pass. It is not a final recommendation, a world-first claim, or proof that it meets the user's desired ambition.

**Audience hypothesis:** solo operators of independent stores accepting PayPal who unexpectedly lose production capacity. Etsy reports illustrate the underlying problem; they do not establish adoption or demand among independent PayPal merchants. The prototype would not move Etsy payments outside Etsy or claim to bypass a platform refund deadline.

**Problem statement:** when an owner cannot work for a known period, how can they prepare a correct, reviewable plan for every already-paid commitment, obtain required customer decisions, and verify each approved financial outcome without manually reconstructing all order conversations?

**Illustrative result:** the owner specifies an interruption until Monday and an available recovery capacity. AI reads the order-associated conversations, identifies stated hard dates and customer requests with source passages, and prepares a per-order decision list. Deterministic rules calculate feasible revised dates and amounts. Orders with missing shipment/payment evidence stay unresolved. The owner reviews draft communications and proposed wait/cancel choices. Customer agreement precedes any revised promise; every refund requires approval and its actual outcome must be verified.

**Candidate difference to test:** one interruption event creates a whole-backlog plan governed by cross-order recovery capacity, individual customer constraints, and verified payment/refund state. A canned absence response or isolated support action does not demonstrate this combination. Existing support products may already reproduce it with workflows or integrations, so no exclusive capability claim is justified by this research alone.

**Meaningful AI:** interpreting different customer instructions and conflicting dates, explaining uncertainties, preparing appropriate questions and reviewable communications. Ordinary scheduling, totals, payment verification, and duplicate-action prevention remain deterministic.

**Meaningful PayPal:** authoritative capture/refund status and approved sandbox refunds against the original transaction, with amounts and execution state bound to the agreed plan. [Payments v2 documentation](https://developer.paypal.com/api/payments/v2) is the starting reference; detailed refund eligibility, balances, deadlines, fees, and API entitlements must be checked before implementation. Authentication alone does not establish them. Do not model a refund request as completed or assume fees are recovered.

**Possible sponsor fit:** [AG Grid](https://paypalaihackathon.devpost.com/details/aggrid) for the reviewable decision list and payment outcomes; [Bryntum](https://paypalaihackathon.devpost.com/details/bryntum) for recovery capacity if a zero-cost judging path is established; [APIMatic](https://paypalaihackathon.devpost.com/details/apimatic) and [Postman](https://paypalaihackathon.devpost.com/details/postman) for API development/verification. Browser agents and retail-product search add no established value here. Sponsor usage is optional, and time-limited offers do not establish permanent free access.

**Smallest informative experiment, only after agreement:** labeled sample backlog with shipped, unshipped, unpaid, previously refunded, hard-date, flexible-date, and ambiguous cases. Evaluate correct classification, unsupported promises, revised-capacity violations, duplicate financial proposals, confirmation handling, and owner review time. Then run one approved sandbox financial action and verify its result. No outreach or actual customer messages are authorized by research.

**Reasons not to commit yet:** published anecdotes lack quantified active time and loss; disruptions may be too infrequent to justify a subscription; Gorgias plus existing workflows may cover the combination; integration/setup may exceed the saved effort; the user has previously rejected recovery-oriented concepts. These are material selection concerns, not a list of hypotheticals to burden the user with.

## Current conclusion

This pass establishes genuine reported headaches and eliminates several concepts with direct competitors. It does **not** establish a unique, market-fit, prize-winning product. The interruption plan is a bounded discovery lead with a documented feature limitation and meaningful PayPal/AI roles, but it has not passed competitive differentiation or commercial validation.

The [official rules](https://paypalaihackathon.devpost.com/rules) require meaningful implementation and judge implementation, design, impact, innovation, and presentation equally. No prescribed industry or hidden sponsor preference was found. A credible novelty statement must name a demonstrated difference from existing concepts; including every sponsor tool or selecting an obscure industry is insufficient.

Keep final product selection open. No final product code, payment, signup, deployment, publication, submission, or outreach was performed.
