# Beyond Laravel → Alpha Node ERP gap matrix

Baseline: Alpha `ABT_ERP_V.2.3.1` (tag `ff12832`). Source: Beyond Tech `laravel-app` Stocky admin.  
Preserve: Landing, About, Shareholders, DB `u152889834_alphabridge`.

| Beyond module | Alpha status | Parity target |
|---------------|--------------|---------------|
| Products / categories / brands / units / barcode / adjustments | Strong | Stock-count workflow later |
| Warehouses | Done (Settings) | Keep off sidebar |
| Sales / POS / registers | Strong | Minor gaps only |
| Quotations | Strong | OK |
| Purchases / suppliers | Thin | Full list/add/edit/receive/return |
| Deliveries + e-sign | Partial | Status + verify flow |
| Transfers | Thin | Full move + stock |
| Sale / purchase returns | Thin | Full with stock restore |
| Expenses / payments / accounts / money transfers | Thin | COA + transfers + BS/P&L |
| Rentals / bookings | Strong | Goods receipt / contract edges |
| Contracts / ERP letters | Thin | CRUD + templates |
| Fixed assets | Thin | Categories + dispose |
| Reports hub | Missing | New reports API + page |
| Coupons / gift cards | Missing | Deferred |
| SalePro employees/attendance | Skip | Alpha HR kept |

Waves: 1 Purchases → 2 Transfers/Returns → 3 Accounting → 4–5 Deliveries + Reports → 6–7 Heavy + rentals leftovers.

## Status after implementation pass (post `ABT_ERP_V.2.3.1` backup)

| Wave | Delivered |
|------|-----------|
| 0 Backup | Tag `ABT_ERP_V.2.3.1`, `backups/alphabridge-pre-parity-20260805/` (env, DB dump, uploads) |
| 1 Purchases | PUT, payments CRUD, multi-line UI (`PurchasesPage.jsx`) |
| 2 Transfers/Returns | GET/DELETE + stock reverse; `TransfersPanel` / `ReturnsPanel` |
| 3 Accounting | Account/expense/payment/money-transfer mutate + P&L; `AccountingPanels` |
| 4 Deliveries | GET/PUT/DELETE, courier/delivered_at patches, richer UI |
| 5 Reports | `/erp/reports/*`, `ReportsPage`, menu → `/admin/erp/reports` |
| 6–7 Heavy + rentals | Contract/template/letter/asset DELETE/PUT; booking goods-receipt |
| Brand guard | Landing/About/Shareholders untouched; deploy still forces Alpha DB name |
