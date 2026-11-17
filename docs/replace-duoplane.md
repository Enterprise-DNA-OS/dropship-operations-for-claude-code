# Move the supplier desk from Duoplane

## Export

In Duoplane, use Product Search, then Export and select the inventory summary in CSV. [The vendor documents these headings](https://support.duoplane.com/hc/en-us/articles/360047763471-Export-Product-Information): id, name, retailer_sku, vendor_sku, price, cost, vendor_name, quantity_available and active. This base reads those fields directly. Record the currency and the time at which the stock was measured. If you cannot establish stock freshness, use the oldest defensible timestamp and treat the result as stale.

For orders, go to Orders, PO Search, choose the required scope, then Downloads and CSV with item detail. [Export instructions](https://support.duoplane.com/hc/en-us/articles/360047813171-Export-a-Purchase-Order-Data-File) and [item detail downloads](https://support.duoplane.com/hc/en-us/articles/4653692158605-Download-CSV-or-PDF-Copies-of-Orders). Duoplane allows configurable headings. Its [bulk-update guide](https://support.duoplane.com/hc/en-us/articles/360047357592-Update-Purchase-Orders-in-Bulk) documents Purchase Order ID, Purchase Order, Vendor name, Order Item ID, Vendor SKU, Item Name, Item Cost Each, Promise Date and PO Confirmation Time.

The PO import also requires customer order reference, placed date, ordered quantity and cumulative shipped quantity. Verify their headings in your actual export and map them. Customer delivery expectation and retention review are local business fields. The example PO file includes those prepared columns and is not a claim about a universal Duoplane export. Split data by currency before importing. Convert date-only fields to YYYY-MM-DD in the agreed business calendar. Confirmation timestamps need ISO time with timezone; a nonblank vendor flag alone is not a timestamp.

## One command per prepared file

```bash
node scripts/dropship.mjs import duoplane products.csv --kind=products --currency=NZD --stock-at=2026-11-17T09:00:00Z --by="Your name" --dry-run
node scripts/dropship.mjs import duoplane orders.csv --kind=orders --currency=NZD --by="Your name" --dry-run
```

Set the values from your export and remove `--dry-run` to apply. `--map=map.json` takes canonical-field-to-heading mappings; see `examples/column-map.json` and the CLI reference. Defaults `--placed`, `--retain` and `--delivery` apply to every order in that file. Use them only when the whole file shares those dates. Mapping one file and reconciling its balances is the switch-in-a-day scope; live store connections are a separate implementation.

## What maps

Products retain their stable Duoplane ID, supplier and both SKU references. Re-import updates the stock snapshot by source ID, refuses older snapshots and never removes omitted products. Keep inactive products explicit. Supplier names are matched case-insensitively; new suppliers require an owner and agreement reference through `review-vendor`.

Orders retain source IDs, purchase-order numbers, customer order references, supplier, currency, ordered quantities, historical shipped quantities, costs and ship promises. Existing identical lines are left alone. Changed imported lines are refused so a re-import cannot silently overwrite local shipment history. New lines can be added. Existing order headers are retained after identity checks; use operational commands for confirmations and promises. Changed delivery or retention rules need a reviewed migration through `/customise`.

An imported shipped balance reduces the open quantity but is not a delivery receipt. Do not record that same historical dispatch again as a new shipment. Local shipment commands are only for dispatches beyond the baseline. The complete original shipment archive remains external.

## Reconcile before cutover

Compare supplier count, product count, PO count, line count, ordered units, shipped baseline and remaining cost by currency. Check each partial shipment and return. Compare promised ship dates separately from customer delivery expectations. Resolve missing evidence and supplier owners. Keep the source files, original shipment history and Duoplane available until the owner signs off the comparison.

Store connections, vendor portal permissions, routing formulas, product bundles, messages, attachments, invoices, payments and original audit history do not migrate through these CSV imports. Enterprise DNA maps and tests the additional work for the version it builds and runs. The base never sends an order, communicates with a vendor or changes a store.
