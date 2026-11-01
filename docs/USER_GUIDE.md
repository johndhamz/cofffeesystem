# User Guide — Coffee Roastery OS

Coffee Roastery OS runs the whole flow of a specialty roastery: buying green coffee, roasting,
packaging, selling, and knowing what everything cost. Everything is in grams and Philippine pesos.

## Signing in

Your owner invites you by email. Open the link in the invitation, choose a password, and you are
in. If the link expired, use **Forgot your password?** on the sign-in page. Roles decide what you
can do:

| Role            | Can do                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| Owner           | Everything, including settings, roasters, expenses and financial reports |
| Roaster         | Roast batches, roast profiles, packaging, green coffee catalog           |
| Inventory staff | Suppliers, purchases, receiving, adjustments, packaging, locations       |
| Sales staff     | Customers, orders, fulfilment, payments, returns                         |
| Viewer          | Read-only on operations (no money reports)                               |

## The flow at a glance

**Purchases → Receive (green lots) → Roast (roasted bulk) → Package (finished bags) → Sell → Pay.**
Stock only changes when you _post_ a document: receiving, completing a roast, completing a
packaging session, fulfilling an order, posting an adjustment or a return. Drafts never move stock.

## Team members and security

**Settings → Team members** (owner): invite a teammate by email and role, resend an invitation,
change a role, or deactivate someone who left (their history stays). A business always keeps at
least one active owner.

**Settings → Security** (everyone): enable two-factor authentication. Scan the QR code with Google
Authenticator, Authy or 1Password, type the 6-digit code once, and from then on sign-in asks for a
code after your password. Owners can make this mandatory for everyone in Settings → Business
(_Require two-factor authentication_); members without an authenticator are sent to Security until
they enrol. Lost your phone? Ask an owner to remove the authenticator.

**Add to home screen**: on a phone or tablet, open the app in Chrome/Safari and choose _Add to Home
Screen_ / _Install_. It opens full-screen like an app. If the connection drops you will see an
offline page; nothing is saved offline, so reconnect and try again.

## Settings (owner)

Settings → Business: name, default roaster and default location, and whether two-factor
authentication is required. Settings → Suppliers / Roasters /
Locations / Expense categories / Sales channels, and Green Coffee for the coffee catalog. Deactivate
records instead of deleting them; history is kept.

## Purchasing green coffee

1. **Purchases → New purchase**: supplier, date, items (coffee, kilograms, cost per kg), optional
   additional costs (freight). Save as draft.
2. **Confirm** to lock prices. 3. **Receive goods**: enter the kilograms actually received per
   line (partial receipts allowed), optional lot code, moisture and density, and landed costs for
   this delivery. **Post receipt** creates a green lot with its actual cost and adds stock.

## Roasting

1. **Roast Production → New roast**: choose the roaster, location, one or more green lots and
   the grams of each. A warning shows if you exceed the roaster's capacity (the Yoshan DY-2kg is
   2,000 g).
2. **Start roast**, then record measurements (time, bean/environment temperature, gas, airflow,
   drum) and events (first crack, drop). The curve chart updates as you add readings. Attach an
   Artisan log or a screenshot if you have one.
3. **Complete roast**: roasted output grams, roast level, duration, first-crack time and the
   LPG/labor costs. The screen previews loss %, yield % and cost per roasted kg. Completing consumes
   the green lots and creates roasted bulk stock in one step. Mistake? **Void** reverses it while
   the roasted coffee is still untouched.

## Packaging

1. **Products**: create a product (e.g. _Sultan Kudarat Robusta_) and its variants (250 g bag,
   500 g bag) with SKU, prices and the packaging materials each unit needs (bill of materials).
2. **Packaging → Materials**: define bags, labels; receive their stock with **Inventory → Materials
   → Receive / adjust** (enter the unit cost).
3. **Packaging → New session**: pick roast batches and grams, products and quantities. The form
   shows required coffee, remaining grams, material needs and a unit-cost preview. **Complete**
   consumes roasted coffee and materials and creates finished-goods lots.

## Inventory

- **Inventory** shows green lots with available grams, cost per kg and value, with filters by
  origin, supplier, process, lot and stock status. Open a lot for balances, cost layers and history.
- **Roasted bulk**, **Finished goods** and **Materials** have their own pages. Every finished lot
  shows its lineage back to roast batches and green lots.
- **Adjustments** correct counts (increase/decrease any item); **Movements** is the full ledger.
  Posted adjustments are undone with **Reverse**, never edited.

## Sales

1. **Customers**: add retail or wholesale customers (wholesale pricing applies automatically).
2. **Sales → New order**: customer (or walk-in), channel, items. Prices come from the variant and
   can be edited; discounts per line or per order. **Confirm & reserve** holds the bags for this
   order (oldest lots first). **Fulfil** ships them and records the exact cost of goods sold.
3. **Record payment** (cash, bank transfer, GCash, Maya): the balance and payment status update;
   a fully fulfilled and paid order becomes _Completed_. **Refund** from a payment when needed.
4. **Return**: inspect each item — _sealed + restock_ puts it back on sale; _quarantine_ or
   _waste_ keeps it out of stock.
5. **Print** gives a customer-facing document.

## Expenses (owner, sales staff for their own)

**Expenses → Record expense** with a category and a _cost treatment_. Choose _Roast production_ or
_Packaging production_ for costs you already entered on batches (LPG, labor) so they are not
counted twice; _Selling_, _Administrative_ and _Other operating_ are period expenses. Attach the
receipt photo. Owners can _Allocate_ an expense to the batch or session it belongs to.

## Dashboard and reports

The dashboard shows stock, production and (for owners) net sales, gross profit, operating
expenses, receivables and charts for the selected dates. **Reports** offers production, green
inventory, finished goods, sales, expenses and profitability, each filterable and exportable to CSV
and PDF. These are management reports, not statutory statements.

## Tips

- Use the search box and filters on every list; sorting is on column headers.
- Amounts: pesos with two decimals; weights: grams (kilograms are shown when large).
- If something looks wrong in stock, do not delete anything: post an adjustment or a reversal and
  write the reason. Owners can see who changed what in the audit trail.
