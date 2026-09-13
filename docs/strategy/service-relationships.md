# Persistent service relationships — the relationship-forming economic routing layer

The really strong part is that the relationship becomes persistent rather than transactional.

The loop is:

**1. Discovery** — ChatGPT determines the user needs a plumber/heating engineer.

**2. Routing** — Our layer finds suitable providers and normalizes: service area, job type, indicative pricing, availability, ratings/reliability, travel time.

**3. Negotiation** — Our agent contacts Geoff from Plumbsoft by email/SMS/phone, checks his calendar/preferences, gets a quote/time, and reports back.

**4. Booking** — User approves. Calendar events, confirmations, address/job details, reminders handled.

**5. Fulfillment** — Geoff does the job.

**6. Relationship memory** — The important outcome isn't merely "job completed." It's: **User now has a trusted plumber: Geoff from Plumbsoft.**

Then six months later: "Boiler is making that noise again." ChatGPT can say: "Geoff from Plumbsoft handled your last boiler job. Want me to contact him first?"

That changes everything. The traditional marketplace wants the customer to return to **Checkatrade**. Our model wants ChatGPT to remember the **actual service relationship**. Marketplaces become useful primarily for **initial discovery**. After the first successful transaction, Supplier ↔ Customer becomes a persistent edge in the user's service graph. That graph is extremely valuable.

Imagine eventually:

```
HOME SERVICE GRAPH

Plumber       Geoff / Plumbsoft
Electrician   Sarah / SJM Electrical
Cleaner       Ana
Mechanic      Eastside Motors
Dentist       ...
Accountant    ...
Dog sitter    ...
```

ChatGPT doesn't search from zero every time. It knows who you've used, whether it went well, what they charged, their contact channel, what work they performed, approximately where they operate, whether they normally respond quickly. So a future task becomes: **known supplier first → marketplace fallback.** That's how humans actually work.

## Geoff's product: become callable by AI

Initially he doesn't need to change anything. He gets an email: boiler repair request, NG7, Worcester Bosch model X, error Y, photo attached, customer available tomorrow 9–12, reply with availability + likely callout.

Then: connect your calendar and we'll stop bothering you about times you're unavailable. Add standard callout pricing and we'll answer routine quote requests automatically. Tell us areas/jobs you prefer and we'll filter bad leads. Connect accounting and we'll know whether this job is worth taking based on travel and expected margin.

Eventually:

```
Incoming job
    ↓
Agent checks: calendar, location, travel, skills, parts, pricing rules, profitability
    ↓
Likely decision: ACCEPT £135, Tue 10–12
    ↓
Geoff gets: "Boiler repair, £135 expected, 22 min away, tomorrow 10am. Accept?"
```

One tap. That's SparkAgent becoming concrete.

## Agent-to-agent negotiation endpoint

Customer agent: need repair before Wednesday, budget preferably under £180. Geoff's agent: Tuesday 09:30, £125 callout + parts. Customer agent: user unavailable before 11. Geoff's agent: 11:30 works, expected total £150–190. Customer agent: accepted. Human only sees: **Geoff can come tomorrow at 11:30. Expected £150–190. Book?** Most of the commerce interaction disappears.

## AgentUgly becomes easy to explain

Previously "optimize your company for AI" — abstract. Now: **Ask ChatGPT for a plumber in Nottingham. Does it find you? Can it understand what you do? Can it get your availability? Can it get a price? Can it book you?** AgentUgly runs that audit. For Plumbsoft: Discoverable ✅, service area ⚠️, boiler brands ❌, indicative pricing ❌, realtime availability ❌, agent contact ⚠️ email only, instant booking ❌, machine-readable credentials ❌, quote response time unknown. **Agent readiness: 38/100.** Then: fix with AgentBeauty/SparkAgent. That's sellable.

## Acquisition loop: demand recruits supply

Consumer side gives us businesses. User asks "find me someone", we encounter Geoff. If Geoff responds and does good work, we know Geoff is useful. Then: "You've received 4 qualified AI-originated jobs through us. Connect your calendar and price rules to respond instantly." Vastly better B2B acquisition than cold outreach. Demand recruits supply, and supply improves routing. Consumer demand → supplier discovery → transaction → supplier data → better routing → more demand. Clean marketplace flywheel.

## ChatGPT distribution

We don't convince millions to install Plumbsoft Finder. They already tell ChatGPT "my boiler's broken." Our job is to become the **best capability ChatGPT can call at the moment it needs to turn that intent into a real-world action.** Matches domain checker and Pog.Prints exactly: "Is this domain available?" → domain router; "Put Buster on a shirt." → manufacturing router; "Someone needs to fix my boiler." → service router. Common architecture: Human intent → ChatGPT → Market router → Economic actor. And after success: Economic actor → persistent trusted relationship. The product isn't a lead marketplace. It's a **relationship-forming economic routing layer for agents.**
