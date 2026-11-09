# The Business Coach — A Claude Skill

Welcome. This is a Claude *skill* — a self-contained package of instructions and reference material that turns Claude into a specialist on a specific topic. When this skill is installed, Claude stops giving you generic AI advice and starts behaving like a $1,000-an-hour business strategist who has read 100 of the greatest business books ever written and can recall the right framework, the right author, and the right move for your exact situation.

If you've never installed a Claude skill before, don't worry. Installation takes about two minutes and the steps are below.

---

## What this skill actually does

Most AI tools, when you ask a business question, give you a tidy list of generic suggestions. This skill is different. It is built around a single principle: **diagnose before you prescribe**.

When you bring a business question to Claude with this skill loaded, Claude will:

1. **Name the pattern you're stuck in** — using the published name from the book that diagnosed it (e.g. "Technician's Trap," "Ruinous Empathy," "Founder Bottleneck," "Revenue Concentration Risk").
2. **Cite the specific book and author** behind every recommendation, so you can go deeper if you want to.
3. **Tell you the hard truth, with evidence** — including the cost of doing nothing, backed by real statistics.
4. **Give you the exact words to say** when the situation involves a tough conversation (price increase, hard feedback, customer discovery, negotiation).
5. **Build a prioritized action plan with timelines** — what to do this week, by day 30, by day 90.
6. **Cite the specific benchmark** that applies (LTV:CAC, gross margin, revenue concentration, offer score, and so on).
7. **Identify your business stage** — Idea, Early, Growth, Scaling, or Acquisition — because the right advice for a $200K founder is wrong for a $20M founder.

In short: it is built to make the invisible visible. To name the thing you couldn't name, and to hand you the next move.

---

## What's inside the brain

The skill draws on roughly 100 business books. The reference library inside this package contains deep dives, framework breakdowns, stage-specific playbooks, and sample worked answers. Some of the books and authors Claude will pull from include:

- **Strategy & Vision** — *Good to Great* (Jim Collins), *Playing to Win* (Roger Martin), *Zero to One* (Peter Thiel), *Your Next Five Moves* (Patrick Bet-David), *The Innovator's Dilemma* (Clayton Christensen), *Think Again* (Adam Grant)
- **Offer, Pricing & Sales** — *$100M Offers* and *$100M Leads* (Alex Hormozi), *Never Split the Difference* (Chris Voss), *The Challenger Sale*, *Influence* (Robert Cialdini), *Building a StoryBrand* (Donald Miller)
- **Customer Discovery & Validation** — *The Mom Test* (Rob Fitzpatrick), *The Lean Startup* (Eric Ries), *Dotcom Secrets* (Russell Brunson)
- **Operations & Scaling** — *Traction / EOS* (Gino Wickman), *Scaling Up* (Verne Harnish), *The E-Myth Revisited* (Michael Gerber), *Buy Back Your Time* (Dan Martell), *Profit First* (Mike Michalowicz)
- **People & Culture** — *The Five Dysfunctions of a Team* (Patrick Lencioni), *Radical Candor* (Kim Scott), *Multipliers* (Liz Wiseman), *The Culture Code* (Daniel Coyle), *No Rules Rules* (Reed Hastings), *Extreme Ownership* (Jocko Willink)
- **Mindset, Focus & Habits** — *Atomic Habits* (James Clear), *Deep Work* (Cal Newport), *Essentialism* (Greg McKeown), *The One Thing* (Gary Keller), *Grit* (Angela Duckworth), *Can't Hurt Me* (David Goggins)
- **Money & Wealth** — *The Psychology of Money* (Morgan Housel), *Profit First* (Michalowicz), *Main Street Millionaire* (Codie Sanchez), *The 5 Types of Wealth* (Sahil Bloom)
- **Marketing & Storytelling** — *Contagious* (Jonah Berger), *Building a StoryBrand* (Donald Miller), *Never Eat Alone* (Keith Ferrazzi)

…and dozens more across the deep-dive files.

The point is not the booklist itself. The point is that when you ask "should I raise prices?", Claude isn't guessing — it's pulling the Value Equation from *$100M Offers*, the Ackerman model from *Never Split the Difference*, and the accusation audit from Voss, and stitching them into one answer that fits your specific situation.

---

## How to install the skill (the easy way — Cowork upload)

The simplest way to install this skill is to upload the zip file directly inside Claude's Cowork mode. You don't need to touch any folders, file paths, or terminals. The whole thing takes about 60 seconds.

**Before you start, make sure you have:**
- A Claude account on a **paid plan** (Pro, Max, Team, or Enterprise — Cowork is included with paid plans, not free).
- Cowork mode turned on for your account. If you've never used it, open Claude and look for "Cowork" in the left sidebar.

**The 5 steps:**

1. **Sign in to your Claude account** at [claude.ai](https://claude.ai) and open Cowork mode.
2. **Open Customize** from the left sidebar in Cowork. (This is the menu that brings together your plugins, skills, and connectors in one place.)
3. **Click on Skills**, then click the **`+`** button and choose **"+ Create skill" → "Upload a skill"**.
4. **Choose the zip file** — pick `business-coach-skill.zip` from wherever you saved it. Yes, you upload the zip directly, *not* an unzipped folder. Claude unpacks it for you. *(Verified against Anthropic's current help docs — see Sources at the bottom of this README.)*
5. **Done.** The skill will appear in your Skills list. Make sure the toggle is **on**, and start a new conversation. From here on, any business question you ask Claude in Cowork will trigger the coach automatically.

**To confirm it loaded**, open a new Cowork chat and ask: *"Do you have the business-coach skill available?"* Claude should confirm it sees it. Or just ask any business question — Claude will pull from the skill on its own.

> **Tip:** If you don't see Customize or Skills in your sidebar, go to **Settings → Capabilities** first and make sure **"Code execution and file creation"** is enabled. Skills depend on that being on.

---

## Alternative install — manual file drop (for Claude Code or non-Cowork users)

If you're not using Cowork — for example you're running Claude Code in a terminal, or building with the Claude Agent SDK — you can install the skill the manual way by dropping the unzipped folder into your local skills directory.

1. **Unzip** `business-coach-skill.zip`. You'll get a folder named `business-coach/` containing `README.md`, `SKILL.md`, and a `references/` folder.
2. **Move that folder** into one of these locations:
   - Personal / global skills (Mac/Linux): `~/.claude/skills/business-coach/`
   - Personal / global skills (Windows): `C:\Users\<YourName>\.claude\skills\business-coach\`
   - Project-scoped (only loads in one project): `<your-project>/.claude/skills/business-coach/`
3. **Create the `.claude/skills` folder if it doesn't exist.** On Mac, hidden folders are revealed with `Cmd + Shift + .` in Finder, or just run `mkdir -p ~/.claude/skills` in Terminal.
4. **Restart your Claude session.** The skill is auto-discovered next time Claude starts.

Keep the folder name exactly `business-coach` and don't rename `SKILL.md` — that's how Claude finds the skill.

---

## What's actually in the zip

```
business-coach/
├── README.md          ← (this file)
├── SKILL.md           ← the main instructions Claude reads
└── references/        ← the library of frameworks, deep dives, and templates
    ├── MASTER-FRAMEWORKS.md
    ├── MASTER-FRAMEWORKS-DEEP.md
    ├── ALL-PROBLEMS-COMPLETE.md
    ├── 01-idea-stage.md
    ├── 03-growth-stage.md
    ├── 01-traction.md
    ├── 02-100m-offers.md
    ├── 03-10-deep-dives.md
    ├── 11-23-deep-dives.md
    ├── 24-40-deep-dives.md
    ├── 41-60-deep-dives.md
    ├── 61-100-deep-dives.md
    ├── cant-get-customers.md
    ├── founder-bottleneck.md
    ├── frameworks-cheatsheet.md
    ├── POWER-PROMPTS.md
    ├── RESPONSE-FORMAT.md
    └── SAMPLE-ANSWERS.md
```

---

## How to use the skill — sample questions

Just ask Claude a business question naturally. The skill triggers automatically on phrases like *"how do I grow,"* *"should I hire,"* *"I'm stuck,"* *"coach me,"* *"what framework,"* and any description of a business problem. You don't need a magic command.

Here are some questions to try on your first session:

**For founders in the early days:**
- *"I have an idea for a service business helping interior designers manage client revisions. How do I know if it's actually worth building?"*
- *"I've been working on this product for four months and I have one paying customer. What should I do this week?"*
- *"I keep hearing 'find product-market fit' but I don't know what that actually looks like. How do I know when I have it?"*

**For founders fighting growth problems:**
- *"My business is at $800K and I'm completely the bottleneck. Every decision waits on me. What do I do first?"*
- *"My team avoids hard conversations. We're polite to each other's faces and frustrated in private. Help."*
- *"I want to raise prices but I'm scared customers will leave. Walk me through how to do this."*
- *"I have one client that's 45% of my revenue. I know that's bad but I can't bring myself to turn down the work."*

**For decisions you're stuck on:**
- *"I'm trying to decide whether to hire a salesperson or do it myself for another quarter. Help me think through it."*
- *"Should I niche down to one type of customer or stay broad? My gut says niche but I'm scared of leaving money on the table."*
- *"I have an offer to buy my company at 3x earnings. Is that good?"*

**For when you just need a coach:**
- *"Coach me. I'm exhausted and I don't know if I'm building the right thing anymore."*
- *"What pattern am I stuck in? Here's what's happening: [describe situation]."*

### How to get even better answers

The more context you give in your first message, the sharper the diagnosis. A great prompt usually includes:

1. **Stage** — pre-revenue, early ($0–$1M), growth ($1M–$10M), or scaling ($10M+).
2. **The specific situation** — what's actually happening, not the abstract version.
3. **What you've already tried** — so Claude doesn't waste your time prescribing things you've ruled out.
4. **What you want from this conversation** — a diagnosis, a decision, a script, a 30-day plan.

**Weak prompt:** *"How do I get more customers?"*

**Strong prompt:** *"I run a $400K/year bookkeeping firm serving e-commerce brands. 70% of new clients come from one referral partner who just got acquired and is going quiet. I've tried cold email (no replies) and LinkedIn content (no inbound). I need a 30-day plan to replace that pipeline before it dries up. Diagnose the real problem first, then give me the moves."*

The second version gets you a real strategic answer. The first gets you a tip list.

---

## Some of the frameworks Claude will reference

So you know what you're getting, here's a partial list of the named frameworks and patterns this skill draws from. You don't need to memorize these — Claude will surface the right one for your situation. They're listed here so you can see the depth of what's inside.

- **Value Equation** — `(Dream Outcome × Perceived Likelihood) ÷ (Time Delay × Effort)` — *$100M Offers, Hormozi*
- **Hormozi Core Equation** — `Profit = (Leads × Conversion × Price × LTV) − Costs`
- **The 5 Dysfunctions Pyramid** — Trust → Conflict → Commitment → Accountability → Results — *Lencioni*
- **GWC Test** — Get it / Want it / Capacity — for diagnosing whether someone is in the right seat — *Traction, Wickman*
- **Hedgehog Concept** — Passion × Best-in-World × Economic Engine — *Good to Great, Collins*
- **Flywheel vs. Doom Loop** — *Good to Great, Collins*
- **Buyback Principle & Buyback Rate** — annual income ÷ 2,000 hours = the rate below which you must delegate — *Buy Back Your Time, Martell*
- **The Mom Test** — how to ask customers questions that don't produce false positives — *Fitzpatrick*
- **Build–Measure–Learn loop** — *The Lean Startup, Ries*
- **Radical Candor 2x2** — Care Personally × Challenge Directly — *Kim Scott*
- **Keeper Test** — would you fight to keep this person if they tried to leave? — *No Rules Rules, Hastings*
- **Multipliers vs. Diminishers** — *Wiseman*
- **Ackerman Negotiation** — 65% → 85% → 95% → 100% — *Never Split the Difference, Voss*
- **Accusation Audit** — surfacing every objection before it forms — *Voss*
- **Profit First Allocations** — Profit / Owner Pay / Tax / OpEx — *Michalowicz*
- **5-Second Test** — can a stranger understand your messaging in 5 seconds? — *StoryBrand, Miller*
- **Essentialism's "Clear Yes or Clear No"** — the 60–70% trap — *McKeown*
- **The 40% Rule** — *Can't Hurt Me, Goggins*
- **1% Better Compounding** — 37x in a year — *Atomic Habits, Clear*
- **Five Moves Ahead Thinking** — *Your Next Five Moves, Bet-David*
- **Stage-based diagnosis** — Idea / Early / Growth / Scaling / Exit, each with its own playbook

Plus the *Pattern Library* — a list of named traps Claude will diagnose you with: Technician's Trap, Artificial Harmony, Ruinous Empathy, Mom Test Trap, Competence Ceiling, Key Person Dependency, Doom Loop, Channel Trap, 60–70% Trap, Identity Attachment, Build-Before-Validate, Revenue Concentration Risk, and Founder-as-Bottleneck.

---

## A few notes on getting the most out of it

- **Treat it like a real coaching session, not a search engine.** Tell Claude what you're scared of, what you've tried, and what you actually want. The more honest your input, the better the diagnosis.
- **Don't argue with hard truths immediately — sit with them.** This skill is designed to tell you things you don't want to hear. That's the value.
- **Ask follow-up questions.** If Claude gives you a framework, ask for the script. If it gives you a script, ask for the 30-day plan. If it gives you a plan, ask what could go wrong. Each layer goes deeper.
- **Use it before big decisions, not after.** The best time to talk to a coach is *before* you sign the lease, hire the person, or change the price.

---

## Troubleshooting

**"I don't see Customize or Skills in my Cowork sidebar."**
Two things to check. First, confirm you're on a paid Claude plan — Cowork is included with Pro, Max, Team, and Enterprise, but not Free. Second, go to **Settings → Capabilities** and make sure **"Code execution and file creation"** is turned on. Skills depend on it.

**"The upload failed or the skill won't toggle on."**
Make sure you uploaded the `.zip` file itself, not an unzipped folder. Cowork requires the compressed archive. Also confirm the filename is `business-coach-skill.zip` and that you didn't rename the inner `business-coach` folder or the `SKILL.md` file inside it.

**"Claude says it doesn't see the skill (manual install)."**
If you're installing manually, double-check the path is exactly `~/.claude/skills/business-coach/SKILL.md`. The most common mistake is nesting the folder one level too deep — for example `~/.claude/skills/business-coach/business-coach/SKILL.md` won't work. The `business-coach` folder should sit directly inside `skills/`.

**"I don't have a `.claude` folder."**
That's fine — just create it. On Mac/Linux, open Terminal and run `mkdir -p ~/.claude/skills`, then move the unzipped `business-coach` folder into it. On Windows, create the folder in your user directory.

**"It loaded but the answers still feel generic."**
Give it a meatier prompt. The skill activates on substantive business questions; if you ask something very vague ("help me with my business") it may stay shallow. Use one of the strong prompts above as a template.

**"I want to update the skill later."**
In Cowork, just upload a newer version of the zip — it'll replace the old one in your Skills list. For manual installs, replace the contents of `~/.claude/skills/business-coach/` with the newer version and restart Claude.

---

## Sources for the install steps

- [Use Skills in Claude — Claude Help Center](https://support.claude.com/en/articles/12512180-use-skills-in-claude)
- [Getting started with Cowork — Claude Help Center](https://support.claude.com/en/articles/13345190-get-started-with-cowork)
- [How to create custom Skills — Claude Help Center](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)

---

*Curated and packaged by Zoe Lu — [@leadwithzoe](https://instagram.com/leadwithzoe). Distilled from 100 of the greatest business books ever written. If this skill helps you make a better call, tell me about it.*
