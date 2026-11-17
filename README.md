# Dropship Operations for Claude Code

Own the supplier promises behind every order. Bring Duoplane product and prepared purchase-order exports into your own database. Review acknowledgements, partial shipments, stale stock and returns with Claude Code, Codex, OpenCode or Cursor. MIT licensed.

## Three ways to use it

- **Do it yourself:** install the free base and run your own supplier desk. Hosting and your coding-agent subscription remain your costs.
- **We customise it:** Enterprise DNA maps your Duoplane exports, adds your supplier rules and builds the store connections, web front end or different stack your team needs.
- **We run it for you:** Omni by Enterprise DNA installs, connects and operates your version. One setup fee, then a retainer. [Book a 30-minute call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=duoplane&utm_medium=readme).

## Try the fictional retailer

```bash
npm install
npm test
npm run demo
```

Node 22 or later. The demo uses a temporary PGlite database, renders three dashboards and three document types, prints three real command runs and removes its own files. Add `-- --keep` to retain the demo directory. It never seeds your business database. Dates in demo records are relative to the day you run it.

## Start your supplier desk

```bash
npm run migrate
node scripts/dropship.mjs init --name="Your business" --by="Your name"
node scripts/dropship.mjs import duoplane your-products.csv --kind=products --currency=NZD --stock-at=2026-11-17T09:00:00Z --by="Your name" --dry-run
```

Set the currency and stock timestamp to the actual export values. Then remove `--dry-run` to apply the same import. Product inventory-summary headings are documented by Duoplane. Purchase-order exports need quantities and historical shipped balances mapped as described in [the switching guide](docs/replace-duoplane.md). Examples are fictional fixtures, not captured customer exports.

`DATABASE_URL` selects Postgres. Otherwise `DATA_DIR` selects embedded PGlite, defaulting to `.data/db`. `OUTPUT_DIR` controls exports, documents, drafts and views. One business and one trusted operator per workspace. Operator labels record who said they performed the action, not an authenticated identity. Keep the owner database connection private.

The base ships 30 CLI operations and 36 task recipes in one command library.

## Five recurring jobs

1. `/supplier-promises`: find overdue and missing ship promises.
2. `/acknowledgements`: review unconfirmed lines and record supplier receipt.
3. `/stock-review`: check supplier stock age before discussing availability.
4. `/shipment-reconcile`: reconcile ordered, already shipped and newly dispatched units.
5. `/weekly-review`: combine supplier exposure, attention items and compliance findings into a draft.

`/return-review` keeps the consumer case attached to its supplier line. Shipment and return commands refuse quantities beyond their remaining balances. Every mutation is atomic and records its operator and evidence. Imports never send orders or update a store.

## Documents and read-only views

Set the business name, colours and optional logo in `brand.json`. `npm run docs` renders purchase-order working copies, supplier review packs and return records. `npm run view` renders the week, supplier exposure and stock freshness. `/draft-chase` prepares a private supplier follow-up. `/new-view` adds a read-only report.

`/compliance` checks recorded delivery expectations, retention review dates and missing internal evidence. [Sources and limits](docs/compliance.md). A clean check does not certify legal compliance. Ship promises and customer delivery dates are separate records. Imported shipped balances do not prove delivery.

## Ten questions answered today

`/insights` runs these queries. Duoplane has reporting and supplier scorecards of its own. These are included analyses, not an unsupported claim that its reports cannot answer them.

1. Which unconfirmed lines are already late?
2. Which customer orders are split across suppliers?
3. Which remaining lines rely on stale supplier stock?
4. Which products have a negative unit spread before freight?
5. Which late orders still have no evidenced delivery?
6. Which suppliers carry the largest outstanding cost by currency?
7. Which partially shipped lines are still overdue?
8. Which returned items still need a decision?
9. Which purchase orders need a retention review?
10. Which active stock records lack an accountable supplier owner?

## Your first hour: ten things to ask for

1. Show the late promises with no supplier acknowledgement.
2. Find customer orders split across suppliers.
3. Show stale stock behind unfinished orders.
4. Explain why an imported shipment has no delivery evidence.
5. Record a supplier's revised promise with its source.
6. Reconcile a partial shipment against the order.
7. Draft a supplier follow-up without sending it.
8. Render the return case in our business colours.
9. Add a region view with `/new-view`.
10. Add our supplier priority field with `/customise`.

## What this base covers

The operational record and review workflows run without store credentials. There is no live store sync, supplier portal, message delivery, carrier tracking lookup, stock reservation, automatic routing, bundle explosion, tax calculation or payment processing. Stock comparisons are per line and do not reserve or allocate shared stock across orders. Unit spread excludes freight, tax, returns and other costs. Outstanding supplier costs are grouped by currency, never converted or summed across currencies.

A return outcome records a decision; it does not issue a refund. Records are retained for review, with no delete or automatic purge command. Source references are pointers, not stored evidence files. JSON export is a complete readable archive, not a database restore tool. Keep original exports and tested backups. Connections and authenticated multi-user access need implementation and acceptance testing for your version.

[CLI reference](docs/cli.md) · [Research](docs/research.md) · [Why no front end](docs/why-no-front-end.md)
