# **Working Agreement**

## The Lens

- Attention is the scarce resource, not time and not code.  
- Optimize for valuable customer outcomes per unit of attention.  
- The bottleneck is never the code. It is knowing what to build.  
- Leverage multiplies judgment in both directions. Fix the judgment first.  
- Fewer than 10 customers means learning is the product.

## Focus

- Be right about the numbers.  
- Own the KPI definitions and the data path that produces them.  
- Own the company-context schema.  
- Own the LLM input/output contract.  
- Protect time-from-idea-to-in-front-of-a-customer above all other metrics.  
- Do the unscalable, consulting-like work. That is where the product comes from.

## Don't Focus

- Backend architecture. Keep it disposable.  
- Integration frameworks. Write explicit adapters.  
- Test coverage as a goal.  
- Eval infrastructure.  
- Observability platforms, SLOs, error budgets.  
- Self-serve.  
- Project management machinery.  
- Anything that exists because it sounds like good engineering.

## Decisions

- Two-way door: decide in minutes and move.  
- One-way door: slow down and write one ADR paragraph.  
- The one-way doors are KPI definitions, data model, pipeline idempotency, auth and tenancy, the LLM contract, integration semantics.  
- Invest in contracts and semantics. Keep implementations cheap.  
- Boring, managed, simple by default.  
- Spend novelty on the methodology and the AI. Nowhere else.  
- Build the monolith. Expect to throw it away.  
- Extract an abstraction on the third instance, never the first.  
- Refactor only immediately before building on the mess.

## AI

- AI writes. I specify and verify.  
- Plan before code. Review the plan, not just the diff.  
- Correctness-critical work gets a spec with acceptance criteria.  
- Promote acceptance criteria into tests.  
- Small batches.  
- If I explain the same thing twice, it goes in CLAUDE.md.  
- One hand-written CLAUDE.md per repo, under 150 lines.

## Quality

- A wrong number in front of a customer is the only real emergency.  
- Every KPI reconciles against the source system's own number.  
- One golden dataset. Assert on it.  
- Contract test each integration for schema drift.  
- Test data and transforms heavily. Test the UI barely.  
- Log the failure reason, not just the failure.

## Work

- One list. Now, Next, Not now.  
- Maintain the Not now list so dropped ideas stop costing attention.  
- Every item names the customer outcome it serves.  
- Issues are my queue. The strategy doc is ours.

## Knowledge

- Only you and the agent read it: git.  
- You and the CEO write it: Drive.  
- Nobody reads it again: an ADR, or delete it.  
- Document facts about the outside world and records of past decisions.  
- Never document my own current structure. The code is more accurate.  
- If it changes when I refactor, it does not belong in docs.  
- If it changes weekly, it does not belong in the foundation.  
- Capture why, not what.

## Change the System When

- A wrong number reached a customer.  
- I broke the same area twice.  
- I hand-fixed the same AI failure repeatedly.  
- Manual data checks stopped being eyeballable.  
- I can't remember why I built something a certain way.  
- Never before one of these fires.

## Stop and Simplify When

- I am testing code that changes weekly.  
- I am maintaining docs nobody reads.  
- I built infrastructure before a failure demanded it.  
- I am tuning the methodology instead of using it.
