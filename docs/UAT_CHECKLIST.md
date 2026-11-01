# User Acceptance Testing Checklist

Perform on **staging** with real-looking data. Tester initials and date per line. Any ❌ blocks release.

## Purchasing

- [ ] Create supplier; duplicate name is rejected with a clear message.
- [ ] Create green coffee with blank altitude/moisture (unknown values allowed).
- [ ] New purchase: 10 kg at ₱450/kg shows ₱4,500 total; draft saved; edit works; confirm locks items.
- [ ] Receive 6 kg then 4 kg (two receipts); PO shows partially received then received.
- [ ] Receipt with ₱100 landed cost: lot cost per kg increases accordingly; receipt shows cost breakdown.
- [ ] Attempt to receive more than ordered → rejected; nothing posted.
- [ ] Green inventory shows the lot with correct available grams and value.

## Roasting

- [ ] New roast with 1,500 g from the lot; capacity warning appears above 2,000 g.
- [ ] Start roast; add 3+ measurements; chart draws BT/ET/RoR; add first crack and drop events.
- [ ] Attach a PNG; an .exe is rejected.
- [ ] Complete with 1,260 g: loss 16 %, yield 84 %, cost per kg shown; green lot decreased by 1,500 g; roasted bulk 1,260 g.
- [ ] Completing again / refreshing does not duplicate stock.
- [ ] Void a completed roast (untouched): green restored, roasted removed; void after packaging is refused.

## Packaging

- [ ] Product + 250 g variant with BOM (1 bag); materials received with unit cost.
- [ ] Session: 1,250 g from the batch → 5 bags; remaining 0 g preview; materials prefilled (5).
- [ ] Complete: roasted 10 g left, 5 finished units, 5 bags consumed, unit cost shown.
- [ ] Session with insufficient coffee/materials is refused; draft remains.
- [ ] Finished lot page shows lineage to the roast batch and green lot.

## Inventory

- [ ] Filters (origin, supplier, process, lot, stock status) and sorting work.
- [ ] Positive and negative adjustments post; negative beyond stock is refused.
- [ ] Reverse an adjustment: balance restored; both documents visible in history.
- [ ] Movements page lists every change with type, quantity and user; no reconciliation banner.
- [ ] Low-stock threshold on a lot changes its status badge.

## Sales

- [ ] Customer (retail) and wholesale customer; wholesale price applied when selected.
- [ ] Order of 3 bags: confirm reserves (lots shown); second order beyond stock is refused.
- [ ] Fulfil: 2 units remain; cost snapshot per unit shown; order status Fulfilled.
- [ ] Partial fulfilment (ship 1, then rest) works; cancel after fulfilment is refused.
- [ ] Print document shows items, totals and balance.
- [ ] Return 1 sealed → restock (stock +1); 1 damaged → waste (no stock).

## Payments

- [ ] Partial payment → Partially paid; remainder → Paid and order Completed.
- [ ] Same reference twice is refused; overpayment is refused.
- [ ] Refund part of a payment → Partially refunded; balance due increases; stock unchanged.
- [ ] Customer page shows orders, revenue and outstanding correctly.

## Expenses

- [ ] Record LPG with _Roast production_ treatment: not counted in operating expenses.
- [ ] Record rent with _Administrative_: counted in operating expenses and the profitability report.
- [ ] Allocate part of an expense to a roast batch; over-allocation refused; receipt upload works.
- [ ] Void an expense: excluded from reports; cannot be edited afterwards.

## Reporting

- [ ] Dashboard date filter changes metrics and charts; viewer sees no money metrics.
- [ ] Production, green inventory, finished goods, sales, expenses, profitability reports open with filters.
- [ ] CSV and PDF exports download and match on-screen totals.
- [ ] Profitability: net sales − COGS = gross profit; − operating expenses = operating result.
- [ ] Non-owner opening a financial report gets _Access denied_.

## Team and security

- [ ] Owner invites a teammate; the email arrives; the teammate sets a password and lands on the dashboard with the right role.
- [ ] Changing a role takes effect on the teammate's next page load; deactivating sends them to "no business".
- [ ] The owner cannot deactivate themselves or demote the only owner.
- [ ] A member enrols an authenticator; the next sign-in asks for a code; a wrong code is rejected.
- [ ] With _Require two-factor authentication_ on, a member without an authenticator is sent to Security until enrolled.
- [ ] On a phone, _Add to Home Screen_ installs the app with the coffee icon; airplane mode shows the offline page.

Sign-off: ______________________ (owner) Date: __________
