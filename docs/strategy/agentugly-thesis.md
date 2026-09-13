# AgentUgly thesis — normalized intent → qualified supplier → quote → schedule → booking rail that ChatGPT can call

Yes. This is **much closer to the real AgentUgly thesis** than "AI SEO."

The key object is not the tradie marketplace. It is the **normalized intent → qualified supplier → quote → schedule → booking rail that ChatGPT can call**.

And the current market is already validating almost every piece separately.

Checkatrade now has an affiliate API specifically for creating jobs programmatically, and its developer docs even publish an `llms.txt`/OpenAPI-friendly surface for agents. ([CAT Affiliates][1]) Thumbtack's 2026 Partner Platform exposes pro search, service requests, leads, messaging, reviews and on-demand orders. ([Thumbtack Developers][2]) Taskrabbit's API now exposes the full chain: estimate → availability → bid → booking → scheduling. ([Taskrabbit Developer Hub][3])

So your flow is not speculative anymore.

## The future interaction is exactly this

User:

> My boiler is making this noise. Is it dangerous?

ChatGPT inspects photo/audio/context, gives safe troubleshooting, then decides:

> This probably needs a heating engineer.

At that point the user should not have to leave ChatGPT and start manually googling.

ChatGPT already knows:

* the problem description
* photos
* approximate urgency
* location
* preferred budget
* potentially calendar availability
* potentially email/phone capabilities.

Then it calls something like:

`find_local_service_pros(...)`

Our router queries:

* Checkatrade
* Taskrabbit
* Thumbtack where relevant
* independent local directories
* direct partner businesses
* eventually our own provider network.

Then returns:

| Provider             |      Earliest |  Indicative quote | Rating/confidence | Travel |
| -------------------- | ------------: | ----------------: | ----------------: | -----: |
| James Heating        | tomorrow 9–11 |         £110–£150 |              high | 3.2 mi |
| Nottingham Boiler Co |     today 4–6 |      £150 callout |              high | 5.1 mi |
| Smith & Sons         |   Wed morning | quote after photo |            medium | 2.7 mi |

Then user says:

> Get James.

And the system handles the rest.

---

# The really strong part is asynchronous negotiation

This is where it gets better than Checkatrade.

Today marketplaces mostly do:

`customer submits lead`
→ several tradespeople receive it
→ phone calls/messages begin.

Your proposed layer can instead act as the **buyer-side procurement agent**.

It can contact five providers with the *same structured job*:

> Boiler model X
> error code Y
> photo attached
> leaking intermittently
> Nottingham NGx
> customer free Tue 9–12 or Wed 14–18
> parking available
> wants diagnosis + likely repair
> respond with earliest slot + callout + likely range.

Then normalize the responses.

ChatGPT reports:

> Three replied. James is cheapest at £95 callout and can come tomorrow 9–11. Helen can come today at £140. BoilerPro quoted £120–£180 Wednesday.

That is basically:

> **RFQ infrastructure for ordinary humans.**

And ChatGPT becomes the procurement manager.

---

# This already exists partially, which is great validation

Angi launched a ChatGPT integration in 2026 specifically to move users from home-improvement advice into matching with local professionals and quote requests inside the conversation. ([Angi][4])

There are also newer AI-native home-service marketplaces like GeraHome exposing REST/API + MCP specifically so agents can find verified providers, get price estimates and complete bookings. ([GeraHome][5])

And startups like Homeserv are explicitly pitching:

> snap a photo → AI scopes job → get three vetted quotes → book.

([Homeserv][6])

So the obvious vertical implementation is happening.

But the **horizontal normalization layer** is more interesting.

---

# AgentUgly becomes the supplier-side product

The consumer side is:

### AgentRouter

> Find the best person/company to satisfy this intent.

The B2B side is:

### AgentUgly

> Why aren't you being selected by agents?

Take a Nottingham plumber.

Today he worries about:

* Google Maps ranking
* Checkatrade
* Facebook
* reviews
* SEO.

Tomorrow he additionally worries:

> When ChatGPT needs a plumber in Nottingham at 3 PM tomorrow, **am I eligible to be selected?**

AgentUgly tells him:

* your service area isn't machine-readable
* availability isn't exposed
* your callout fee is unclear
* no structured service list
* no API/booking endpoint
* reviews aren't accessible
* you don't expose boiler brands serviced
* no real-time travel radius
* no structured insurance/credentials
* no response SLA
* you only accept phone calls.

Then AgentBeauty/SparkAgent fixes it:

> connect calendar
> expose availability
> publish service taxonomy
> expose indicative pricing
> respond to RFQs
> add agent-friendly booking endpoint.

---

# The tradie doesn't need an "agent" initially

At first:

**customer side** = fully agentic.

**tradie side** = email/SMS/phone.

So James doesn't install anything.

ChatGPT sends:

> Subject: Boiler repair enquiry — NG7 — tomorrow morning

James replies:

> Can do 10am, £95 callout, probably £150–220 total depending on valve.

Our parser normalizes that.

ChatGPT tells user:

> James can do 10am, £95 callout.

User approves.

We reply:

> Confirmed. Customer address/details attached.

Calendar event created.

Done.

That's enormously easier than requiring a two-sided app install.

---

# Then progressively upgrade the supply side

### Stage 0

Email/SMS.

### Stage 1

Simple link:

> Accept / decline / suggest time.

### Stage 2

Calendar integration. Now we know probable availability.

### Stage 3

Business profile:

* service radius
* pricing rules
* skills
* equipment
* job preferences.

### Stage 4

Agent for tradie. Now James' agent can instantly reason:

> Current job ends 8:20
> travel 22 mins
> parts already in van
> £120 callout
> estimated 1.5h
> margin ≈ £87
> accept 9–11.

Customer agent and supplier agent negotiate in milliseconds. That is the end state.

---

# The marketplace structure

Instead of a marketplace page with 50 plumbers:

Intent → RFQ → Bids → Allocation

ChatGPT doesn't need to show 50 businesses. It shows three **Pareto-optimal offers**:

> Cheapest / Fastest / Best-rated.

Exactly like the Pog.Print routing structure. Same architecture:

### Print

intent → providers → quote → normalize → rank → transact.

### Home services

intent → providers → availability/quote → normalize → rank → book.

### Domains

intent → registrars → availability/price → normalize → rank → register.

Convergence:

# **Universal intent routing**

The vertical changes. The primitive doesn't.

---

# Mini-marketplaces

For any user intent I:

I → {P1, P2, …, Pn}

Each provider returns an offer:

O_i = (price, quality, availability, confidence, terms)

Router computes the best utility given user constraints. The LLM performs semantic translation. The router performs **economic allocation**.

Internal primitive idea: `a-market`. Input: intent, constraints, location, budget, deadline, preferences. Providers implement: can_fulfill(), quote(), availability(), book(), status(). Real businesses compete to fulfill intent.

---

# Initial wedge

Do **not** try to normalize every service marketplace. Pick one country + one service category. Example:

### UK heating / plumbing

Why: urgent/high-intent, highly local, fragmented supply, consumers hate calling around, photos/errors provide context, obvious scheduling problem, meaningful job value, tradespeople already use email/WhatsApp/phone.

Expose:

```
find_heating_engineers
request_heating_quotes
compare_heating_quotes
book_heating_job
```

Behind the scenes: Checkatrade API/affiliate job creation, direct independents, email RFQ, later more marketplaces. One very good vertical.

---

# Monetization

* Qualified lead fee: tradie pays £X only when actual qualified opportunity arrives.
* Successful booking fee: percentage or flat amount only when booked.
* Customer procurement fee (probably unnecessary initially).
* Tradie subscription later (£29/mo to become agent-ready: machine-readable profile, instant RFQ response, calendar connection, automatic quote assistant, ChatGPT lead intake — basically SparkAgent again).
* Auction / bid economics: providers pay for preferential eligibility, **but never override actual ranking quality**. Keep ads explicitly separated.

---

# Moat

If we handle enough transactions, we learn per plumber: response probability, true availability, quote accuracy, actual final price, arrival punctuality, cancellation rate, job categories they really like, geographic willingness, acceptance by time/day, customer satisfaction.

Then instead of merely reading "James says he works Nottingham", we know P(James accepts boiler repair in NG7, Tuesday, 10am) = 0.91 and ExpectedPrice = £143 ± £28. We can tell ChatGPT James is probably available tomorrow 9–11 and historically accepts jobs like this at ~£130–160, before James even responds.

---

# Unifying company thesis

Not "another marketplace" but:

> **the interoperability layer between conversational intent and fragmented real-world businesses.**

AgentUgly diagnoses: you're not callable / legible / competitive. AgentBeauty/SparkAgent makes businesses discoverable, structured, quotable, schedulable, contactable, transact-able. Consumer routers generate actual demand for those businesses. Flywheel:

```
CHATGPT USER INTENT
        ↓
   OUR ROUTER
        ↓
   businesses
        ↑
 AgentUgly audit
        ↑
 business tooling
```

[1]: https://developers.checkatrade.com/docs/getting-started
[2]: https://developers.thumbtack.com/docs/getting-started
[3]: https://developer.taskrabbit.com/docs/overview-taskrabbit-home-services-api
[4]: https://www.angi.com/articles/chatgpt-marketplace-announcement.htm
[5]: https://gerahome.com/ai
[6]: https://www.homeservapp.com/
