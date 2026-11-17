# Recorded delivery and evidence checks

Checked 17 November 2026. These checks support a retailer's review. They do not decide legal rights, issue refunds, contact consumers or certify compliance. The base uses NZ sources; Australian businesses must have their own consumer and privacy rules reviewed before deployment.

| Rule | Executable check | Source and meaning |
|---|---|---|
| DELIVERY-REVIEW | A recorded customer delivery date has passed and evidenced delivery is less than the ordered quantity | [Consumer Protection: delivery issues](https://www.consumerprotection.govt.nz/general-help/common-consumer-issues/delivery-issues). Retailers must address delivery problems for services they arrange. The date is the business's recorded expectation, not an invented statutory deadline. |
| RETENTION-REVIEW | The business-set retention review date has passed | [Privacy principle 9](https://www.privacy.org.nz/privacy-principles/9/). Personal information must not be retained longer than needed for its lawful purpose. Review dates prompt a decision; they never authorize deletion. |
| MISSING-DELIVERY | No customer delivery expectation is recorded | Internal control supporting delivery review. No statutory duration is assumed. |
| MISSING-SHIP-PROMISE | An outstanding line has no supplier ship promise | Internal control. A ship promise is not a customer delivery promise. |
| SUPPLIER-OWNER | Supplier has no named owner or agreement reference | Internal accountability control. |
| SOURCE-EVIDENCE | Purchase order lacks a source reference | Internal traceability control. |

## Internal controls

Imports, confirmations, promise changes, shipments, deliveries and return decisions are recorded in append-only history. Local shipments cannot exceed outstanding units. Cumulative returns cannot exceed shipped units. Imported shipment balances remain unverified delivery until separate shipment and delivery evidence is available. A shipment needs a recorded acknowledgement, dispatch date, carrier, tracking reference and evidence. A delivery needs a date on or after dispatch and a new evidence reference.

The application serializes mutations by locking the workspace row. Database owners can bypass application controls. Operator names are labels, not sign-in permissions. Retention checks cannot determine the correct lawful purpose, litigation hold, tax requirement or disposal date. There is no universal retention period here and no automatic deletion. Review exports and original evidence before deciding.

Stock freshness uses the business-set number of hours, default 48. Return review dates are business commitments. Neither is a legal deadline. Supplier stock does not establish an available-to-promise allocation. No consumer details beyond order references are required in the base.
