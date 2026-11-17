# One CLI

`node scripts/dropship.mjs COMMAND [record] --key=value`. Add `--json` for machine-readable output. Every mutation requires `--by=Name`. Dates are real YYYY-MM-DD values. Timestamps require seconds and timezone. Money is a nonnegative decimal with at most two places, without symbols or separators. Quantities are whole units, up to one million. Partial identifiers and case-insensitive names resolve only when unique; ambiguous matches list candidates and exit 1.

## Commands

```bash
node scripts/dropship.mjs init --name="Business" --by="Operator"
```

```bash
node scripts/dropship.mjs add-vendor --name="Supplier" --owner="Owner" --evidence="Agreement reference" --by="Operator"
```

```bash
node scripts/dropship.mjs review-vendor "Supplier" --owner="Owner" --evidence="Agreement reference" --by="Operator"
```

```bash
node scripts/dropship.mjs add-order --code=SOURCE-ID --number=PO-NUMBER --order=SHOP-ORDER --vendor="Supplier" --currency=NZD --placed=YYYY-MM-DD --delivery=YYYY-MM-DD --retain=YYYY-MM-DD --evidence="Order source" --by="Operator"
```

```bash
node scripts/dropship.mjs add-item --code=LINE-ID --po=PO-NUMBER --sku=SKU --name="Item" --quantity=1 --cost=12.50 --promise=YYYY-MM-DD --by="Operator"
```

```bash
node scripts/dropship.mjs confirm PO-NUMBER --at=YYYY-MM-DDTHH:MM:SSZ --evidence="Supplier acknowledgement" --by="Operator"
```

```bash
node scripts/dropship.mjs promise LINE-ID --date=YYYY-MM-DD --evidence="Supplier response" --by="Operator"
```

```bash
node scripts/dropship.mjs ship LINE-ID --reference=DISPATCH-ID --quantity=1 --carrier="Carrier" --tracking=TRACKING --date=YYYY-MM-DD --evidence="Dispatch record" --by="Operator"
```

```bash
node scripts/dropship.mjs deliver DISPATCH-ID --date=YYYY-MM-DD --evidence="Delivery receipt" --by="Operator"
```

```bash
node scripts/dropship.mjs return LINE-ID --reference=RETURN-ID --quantity=1 --reason="Reason" --review=YYYY-MM-DD --by="Operator"
```

```bash
node scripts/dropship.mjs resolve-return RETURN-ID --outcome="Agreed outcome" --date=YYYY-MM-DD --by="Operator"
```

```bash
node scripts/dropship.mjs log-note --text="Review note" --by="Operator"
```

```bash
node scripts/dropship.mjs import duoplane FILE.csv --kind=products --currency=NZD --stock-at=YYYY-MM-DDTHH:MM:SSZ --by="Operator" --dry-run
```

```bash
node scripts/dropship.mjs export
```

```bash
node scripts/dropship.mjs draft-chase "Supplier"
```

```bash
node scripts/dropship.mjs vendors
```

```bash
node scripts/dropship.mjs products
```

```bash
node scripts/dropship.mjs orders
```

```bash
node scripts/dropship.mjs items
```

```bash
node scripts/dropship.mjs shipments
```

```bash
node scripts/dropship.mjs returns
```

```bash
node scripts/dropship.mjs attention
```

```bash
node scripts/dropship.mjs promises
```

```bash
node scripts/dropship.mjs supplier-review
```

```bash
node scripts/dropship.mjs stock-review
```

```bash
node scripts/dropship.mjs route-check
```

```bash
node scripts/dropship.mjs compliance
```

```bash
node scripts/dropship.mjs insights
```

```bash
node scripts/dropship.mjs history
```

`help` lists every operation. `insights --question=1` through `--question=10` selects one analysis. `init --stock-hours=48` sets the stale-stock threshold (1 to 720 hours). All output paths are controlled by OUTPUT_DIR. Export archives every domain table and the history in JSON. It is not a restore image.

## Import fields

`import duoplane FILE --kind=products|orders --currency=NZD --by=Name [--map=FILE] [--dry-run]`.

Product fields use Duoplane inventory-summary names: id, vendor_name, retailer_sku, vendor_sku, name, cost, price, quantity_available, active. `--stock-at` is mandatory, must include timezone and cannot be in the future. Product source IDs and supplier SKU pairs must be unique. Import updates snapshots by source ID and refuses older stock times. All rows are atomic.

Order canonical fields and default headings:

| Canonical field | Default export/prepared heading |
|---|---|
| po_id | Purchase Order ID |
| number | Purchase Order |
| customer_order | Customer Order |
| vendor | Vendor name |
| placed_on | Order Date |
| retention_review | Retention Review |
| delivery_due | Delivery Due (optional) |
| confirmed_at | PO Confirmation Time (optional, timestamp required) |
| item_id | Order Item ID |
| sku | Vendor SKU |
| name | Item Name |
| quantity | Quantity |
| shipped | Shipped Quantity |
| cost | Item Cost Each |
| promise | Promise Date (optional) |

Use `--map` for different headings. Its JSON object maps a canonical field to the real heading, for example `{"quantity":"Units ordered"}`. These overrides also work for product fields. `--placed`, `--retain` and `--delivery` supply whole-file date defaults. Read the switching guide before using them. Blank or malformed required values fail. Omitted rows are never deleted. Existing order headers remain; identical lines are no-ops and changed existing lines are rejected. A repeated product import applies that snapshot again if it is no older than the current one.

Every read runs in a consistent read-only transaction. Every mutation locks the workspace row and appends history in the same transaction. A dry run rolls back records, suppliers, import history and audit history together. The CLI never performs any network operation beyond the configured database connection.
