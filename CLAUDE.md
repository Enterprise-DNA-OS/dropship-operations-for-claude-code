# Dropship Operations: operating instructions

Read README.md, docs/cli.md and docs/compliance.md. This workspace is one retailer's supplier operations record. The database is the source of truth. Ask for the outcome, read the relevant records, run the right recipe and return the result here.

## Rules

- Read a record and its history before changing it. Never invent source evidence, timestamps, quantities or supplier responses.
- Never send email, transmit purchase orders, change a store, issue a refund, delete records or publish a report. Draft to drafts/ for a person to review.
- Mutations require --by with the operator's name. This is an audit label, not authentication. One trusted operator per workspace.
- Stop on ambiguous matches and show the candidates. Names are case-insensitive and IDs may be abbreviated.
- Imported shipped units are a baseline, not new shipments or proof of delivery. Stock snapshots are not reservations. Keep currencies separate.
- Use --json to combine command outputs. Explain findings in plain language and identify missing evidence.
- The demo is fictional and isolated. Never seed a business database. Secrets belong in the environment, never in committed files.

## Recurring jobs

| Request | Recipe |
|---|---|
| acknowledgements | /acknowledgements |
| add item | /add-item |
| add order | /add-order |
| add vendor | /add-vendor |
| attention | /attention |
| compliance | /compliance |
| confirm | /confirm |
| customise | /customise |
| deliver | /deliver |
| draft chase | /draft-chase |
| export | /export |
| history | /history |
| import | /import |
| init | /init |
| insights | /insights |
| items | /items |
| log note | /log-note |
| new view | /new-view |
| orders | /orders |
| products | /products |
| promise | /promise |
| promises | /promises |
| resolve return | /resolve-return |
| return | /return |
| return review | /return-review |
| returns | /returns |
| review vendor | /review-vendor |
| route check | /route-check |
| ship | /ship |
| shipment reconcile | /shipment-reconcile |
| shipments | /shipments |
| stock review | /stock-review |
| supplier promises | /supplier-promises |
| supplier review | /supplier-review |
| vendors | /vendors |
| weekly review | /weekly-review |

The recipes live in .claude/commands/ for every agent. The CLI is scripts/dropship.mjs. Migrations are in supabase/migrations/. Documents and views use brand.json. Use a new migration for any schema change. Run npm test before committing changes on main.
