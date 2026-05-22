Poniżej plan implementacji krok po kroku. Ja bym robił dokładnie w tej kolejności, żeby nie rozjechać DB, snapshotów i UI naraz.

---

## 0. Ustalony model

Decyzje końcowe:

- `position` = lot zakupowy, czyli konkretne kupno.
- `position.quantity` = remaining quantity.
- `position.initialQuantity` = pierwotna ilość.
- `SELL` wybiera konkretny lot albo `Sell All` na symbolu.
- `BUY` używa najpierw `wallet.cashBalance`, brakująca część = nowy wkład.
- `SELL` dodaje proceeds do `cashBalance`.
- opcjonalny withdrawal przy sprzedaży zmniejsza cash.
- manual withdrawal max `cashBalance`.
- `Delete` = korekta błędnego niesprzedanego lotu, odwraca cały BUY.
- snapshot chart:
  - `totalValue = holdingsValue + cashBalance`
  - `netInvested = totalContributed - totalWithdrawn`

---

## 1. DB schema

Plik:

```txt
src/server/db/schema.ts
```

### 1.1. Dodaj enum transakcji

```ts
export const portfolioTransactionTypeEnum = pgEnum(
  "portfolio_transaction_type_enum",
  ["BUY", "SELL", "WITHDRAWAL"]
);
```

### 1.2. Rozszerz `wallet`

Dodaj numeric pola:

```ts
cashBalance: numeric("cash_balance", { precision: 20, scale: 10 }).default("0").notNull(),
totalBuyCost: numeric("total_buy_cost", { precision: 20, scale: 10 }).default("0").notNull(),
totalContributed: numeric("total_contributed", { precision: 20, scale: 10 }).default("0").notNull(),
totalWithdrawn: numeric("total_withdrawn", { precision: 20, scale: 10 }).default("0").notNull(),
realizedPl: numeric("realized_pl", { precision: 20, scale: 10 }).default("0").notNull(),
```

### 1.3. Rozszerz `position`

Dodaj:

```ts
initialQuantity: numeric("initial_quantity", { precision: 20, scale: 10 }).notNull(),
closedAt: timestamp("closed_at"),
```

Semantyka:

```txt
quantity = aktualnie pozostała ilość
initialQuantity = pierwotnie kupiona ilość
closedAt = ustawione, gdy quantity spadnie do 0
```

### 1.4. Dodaj tabelę `portfolioTransaction`

```ts
export const portfolioTransaction = pgTable("portfolio_transaction", {
  id: text("id").primaryKey(),

  walletId: text("wallet_id")
    .notNull()
    .references(() => wallet.id, { onDelete: "cascade" }),

  positionId: text("position_id").references(() => position.id, {
    onDelete: "set null",
  }),

  type: portfolioTransactionTypeEnum("type").notNull(),

  companyName: text("company_name"),
  companySymbol: text("company_symbol"),

  quantity: numeric("quantity", { precision: 20, scale: 10 }),
  pricePerShare: numeric("price_per_share", { precision: 20, scale: 10 }),

  amount: numeric("amount", { precision: 20, scale: 10 }).notNull(),

  cashUsed: numeric("cash_used", { precision: 20, scale: 10 })
    .default("0")
    .notNull(),

  externalContribution: numeric("external_contribution", {
    precision: 20,
    scale: 10,
  })
    .default("0")
    .notNull(),

  realizedPl: numeric("realized_pl", { precision: 20, scale: 10 })
    .default("0")
    .notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### 1.5. Snapshoty

Zmień snapshoty z:

```ts
totalCostBasis
```

na:

```ts
netInvested: numeric("net_invested", { precision: 20, scale: 10 }).notNull()
```

Dotyczy:

```txt
walletDailySnapshot
walletIntradaySnapshot
```

---

## 2. Migracja DB

Wygeneruj migrację:

```bash
npx drizzle-kit generate
```

Potem ręcznie sprawdź plik w `drizzle/`.

W migracji chcesz zrobić:

### 2.1. Skasować stare snapshoty

Ponieważ zdecydowałeś, że nie migrujemy historii snapshotów:

```sql
delete from wallet_intraday_snapshot;
delete from wallet_daily_snapshot;
```

### 2.2. Dodać kolumny wallet

```sql
alter table wallet add column cash_balance numeric(20,10) default '0' not null;
alter table wallet add column total_buy_cost numeric(20,10) default '0' not null;
alter table wallet add column total_contributed numeric(20,10) default '0' not null;
alter table wallet add column total_withdrawn numeric(20,10) default '0' not null;
alter table wallet add column realized_pl numeric(20,10) default '0' not null;
```

### 2.3. Dodać `initial_quantity`

Nie dodawaj od razu jako `not null`, jeśli są istniejące pozycje.

Bezpiecznie:

```sql
alter table position add column initial_quantity numeric(20,10);
update position set initial_quantity = quantity;
alter table position alter column initial_quantity set not null;
alter table position add column closed_at timestamp;
```

### 2.4. Snapshot columns

Najprościej, skoro snapshoty są puste:

```sql
alter table wallet_daily_snapshot drop column total_cost_basis;
alter table wallet_daily_snapshot add column net_invested numeric(20,10) not null;

alter table wallet_intraday_snapshot drop column total_cost_basis;
alter table wallet_intraday_snapshot add column net_invested numeric(20,10) not null;
```

### 2.5. Utworzyć enum i tabelę `portfolio_transaction`

Drizzle powinien to wygenerować.

---

## 3. Backfill istniejących pozycji jako BUY

Po migracji trzeba stworzyć transakcje `BUY` dla obecnych pozycji.

Najbezpieczniej zrób tymczasowy skrypt TS, np.:

```txt
src/server/db/backfill-portfolio-transactions.ts
```

Logika:

1. Pobierz wszystkie portfele.
2. Dla każdego portfela pobierz jego pozycje.
3. Dla każdej pozycji:
   - `amount = quantity * pricePerShare`
   - insert `portfolioTransaction` typu `BUY`
   - `cashUsed = 0`
   - `externalContribution = amount`
   - `realizedPl = 0`
4. Dla walleta ustaw:
   - `cashBalance = 0`
   - `totalBuyCost = sum(amount)`
   - `totalContributed = sum(amount)`
   - `totalWithdrawn = 0`
   - `realizedPl = 0`

Uruchom jednorazowo:

```bash
node --import tsx src/server/db/backfill-portfolio-transactions.ts
```

Po sukcesie możesz usunąć ten skrypt albo zostawić jako dev utility.

---

## 4. Typy

Plik:

```txt
src/server/actions/types.ts
```

Zmień `ChartDataPoint`:

```ts
export type ChartDataPoint = {
  timestamp: number;
  label?: string;
  totalValue: number;
  netInvested: number;
};
```

Rozszerz `PositionData`:

```ts
initialQuantity: number;
closedAt: Date | null;
```

Dodaj ewentualnie typ dla wallet metrics:

```ts
export type WalletMetrics = {
  cashBalance: number;
  totalBuyCost: number;
  totalContributed: number;
  totalWithdrawn: number;
  realizedPl: number;
};
```

---

## 5. Queries

Plik:

```txt
src/server/db/queries.ts
```

### 5.1. `getWalletById`

Musi zwracać nowe agregaty jako number albo potem ręcznie parsować.

Dodaj pola:

```txt
cashBalance
totalBuyCost
totalContributed
totalWithdrawn
realizedPl
```

Jeżeli używasz zwykłego `select()`, Drizzle zwróci numeric jako string. Możesz albo parsować w page, albo zrobić casty w query.

### 5.2. `getWalletPositions`

Filtruj tylko aktywne loty:

```sql
position.quantity > 0
position.closed_at is null
```

Dodaj:

```txt
initialQuantity
closedAt
```

### 5.3. Dodaj helpery

Przydadzą się:

```ts
getPositionLotById(positionId, walletId, userId)
getPositionSellTransactions(positionId)
getActivePositionsBySymbol(walletId, userId, companySymbol)
getWalletCashBalance(walletId, userId)
```

### 5.4. `getAllWalletsWithPositions`

To ważne.

Obecnie masz `innerJoin(position)`, czyli wallet bez pozycji znika ze snapshotów. Po sprzedaży wszystkiego, ale z cashBalance > 0, taki wallet nadal musi dostać snapshot.

Zmień na coś, co zwraca też wallety bez pozycji, np. `leftJoin`.

Snapshot runner musi dostać:

```txt
wallet.id
wallet.currency
wallet.cashBalance
wallet.totalContributed
wallet.totalWithdrawn
position nullable
```

### 5.5. Snapshot queries

Zmień wszystkie `totalCostBasis` na `netInvested`.

Dotyczy:

```txt
getWalletsWithLatestSnapshot
getDailyPortfolioData
getIntradayPortfolioData
getAllWalletsIntradayPortfolioData
getAllWalletsDailyPortfolioData
```

---

## 6. Server actions

Plik:

```txt
src/server/actions/dashboard-actions.ts
```

Wszystkie operacje finansowe rób w `db.transaction`.

---

### 6.1. `addPosition` jako BUY

Obecnie tylko insertuje `position`.

Nowa logika:

1. Auth.
2. Validate wallet.
3. Validate shares/price.
4. Transaction:
   - pobierz wallet z agregatami.
   - ustaw `runningCash = wallet.cashBalance`.
   - dla każdego dodawanego lotu:
     - `buyCost = shares * price`
     - `cashUsed = Math.min(runningCash, buyCost)`
     - `externalContribution = buyCost - cashUsed`
     - `runningCash -= cashUsed`
     - insert `position`:
       - `quantity = shares`
       - `initialQuantity = shares`
     - insert `portfolioTransaction BUY`
   - po pętli update wallet:
     - `cashBalance = runningCash`
     - `totalBuyCost += sumBuyCost`
     - `totalContributed += sumExternalContribution`

---

### 6.2. `deletePosition`

Nowa semantyka: korekta błędnego BUY.

Logika:

1. Auth.
2. Sprawdź wallet.
3. Sprawdź, czy pozycja istnieje.
4. Sprawdź, czy nie ma transakcji `SELL` dla `positionId`.
   - jeśli ma, zwróć błąd validation.
5. Znajdź transakcję `BUY` dla `positionId`.
6. Transaction:
   - update wallet:
     - `cashBalance += buy.cashUsed`
     - `totalBuyCost -= buy.amount`
     - `totalContributed -= buy.externalContribution`
   - delete `portfolioTransaction BUY`
   - delete `position`

---

### 6.3. Usuń/dezaktywuj `deleteAllPositions`

Nie używamy już tej akcji w UI.

Możesz:
- usunąć eksport,
- albo zostawić tymczasowo, ale nigdzie nie podpinać.

---

### 6.4. Dodaj `sellPositionLot`

Sygnatura przykładowa:

```ts
export async function sellPositionLot(
  positionId: string,
  walletId: string,
  prevState: SellState,
  formData: FormData
)
```

Form fields:

```txt
quantity
price
withdrawAfterSale checkbox
withdrawAmount optional
```

Logika:

1. Auth.
2. Wallet belongs to user.
3. Lot active.
4. Validate:
   - `quantity > 0`
   - `quantity <= position.quantity`
   - `price > 0`
   - `withdrawAmount >= 0`
5. Oblicz:
   - `proceeds = quantity * sellPrice`
   - `costBasisSold = quantity * position.pricePerShare`
   - `realizedPl = proceeds - costBasisSold`
   - `withdrawal = checkbox ? withdrawAmount : 0`
   - validate `withdrawal <= proceeds`
6. Transaction:
   - update position:
     - `quantity -= soldQuantity`
     - jeśli nowe quantity = 0, `closedAt = now`
   - insert `SELL`
   - jeśli withdrawal > 0:
     - insert `WITHDRAWAL`
   - update wallet:
     - `cashBalance += proceeds - withdrawal`
     - `realizedPl += realizedPl`
     - `totalWithdrawn += withdrawal`

---

### 6.5. Dodaj `sellAllPositionsForSymbol`

Sygnatura:

```ts
export async function sellAllPositionsForSymbol(
  walletId: string,
  companySymbol: string,
  prevState: SellAllState,
  formData: FormData
)
```

Form fields:

```txt
price
withdrawAfterSale
withdrawAmount
```

Logika:

1. Pobierz wszystkie aktywne loty dla symbolu.
2. Jedna cena sprzedaży dla wszystkich.
3. Oblicz:
   - `totalQuantity`
   - `totalProceeds`
   - `totalRealizedPl = sum((sellPrice - lot.pricePerShare) * lot.quantity)`
4. Validate:
   - `withdrawal <= totalProceeds`
5. Transaction:
   - dla każdego lotu:
     - insert `SELL`
     - set `quantity = 0`
     - set `closedAt = now`
   - opcjonalny `WITHDRAWAL`
   - update wallet:
     - `cashBalance += totalProceeds - withdrawal`
     - `realizedPl += totalRealizedPl`
     - `totalWithdrawn += withdrawal`

---

### 6.6. Dodaj `withdrawCash`

Sygnatura:

```ts
export async function withdrawCash(
  walletId: string,
  prevState: WithdrawalState,
  formData: FormData
)
```

Logika:

1. Auth.
2. Wallet belongs to user.
3. Validate amount > 0.
4. Validate `amount <= wallet.cashBalance`.
5. Transaction:
   - insert `WITHDRAWAL`
   - update wallet:
     - `cashBalance -= amount`
     - `totalWithdrawn += amount`

---

## 7. Snapshot runner

Plik:

```txt
src/server/services/run-snapshot.ts
```

Zmień semantykę:

```ts
holdingsValue = sum(position.quantity * livePrice)
totalValue = holdingsValue + wallet.cashBalance
netInvested = wallet.totalContributed - wallet.totalWithdrawn
```

Uważaj na wallet bez pozycji:

```txt
positions = []
cashBalance > 0
```

Taki wallet powinien mieć snapshot:

```txt
totalValue = cashBalance
netInvested = totalContributed - totalWithdrawn
```

W insertach zmień:

```ts
totalCostBasis
```

na:

```ts
netInvested
```

---

## 8. Chart data

Pliki prawdopodobnie:

```txt
src/app/dashboard/[walletId]/wallet-chart-client.tsx
src/app/dashboard/dashboard-chart-client.tsx
src/server/actions/dashboard-actions.ts
src/server/actions/types.ts
```

Wszędzie zamień:

```txt
totalCostBasis
```

na:

```txt
netInvested
```

Linie na chart:

```txt
totalValue
netInvested
```

Labelka może być np.:

```txt
Portfolio Value
Net Invested
```

---

## 9. Wallet page stats

Plik:

```txt
src/hooks/use-portfolio-stats.ts
```

Teraz stats powinny liczyć:

```ts
holdingsCostBasis = sum(pos.quantity * pos.pricePerShare)
holdingsValue = sum(pos.quantity * livePrice fallback buyPrice)
portfolioValue = holdingsValue + wallet.cashBalance
netInvested = wallet.totalContributed - wallet.totalWithdrawn
unrealizedPl = holdingsValue - holdingsCostBasis
realizedPl = wallet.realizedPl
totalPl = portfolioValue - netInvested
totalPlPercent = netInvested > 0 ? totalPl / netInvested * 100 : 0
```

Czyli hook musi dostać wallet metrics jako props.

W `page.tsx` przekaż do clienta:

```ts
wallet: {
  id,
  name,
  currency,
  cashBalance,
  totalBuyCost,
  totalContributed,
  totalWithdrawn,
  realizedPl,
}
```

---

## 10. UI — Sell lot

Stwórz komponent:

```txt
src/app/dashboard/[walletId]/sell-position-dialog.tsx
```

Props:

```ts
positionId
walletId
companySymbol
companyName
quantity
pricePerShare
currency
currentPrice?
```

Dialog fields:

```txt
Quantity to sell
Sell price per share
[ ] Withdraw from sale proceeds
Withdrawal amount
```

Pokazuj wyliczenia live po stronie klienta:

```txt
Sale proceeds
Realized P/L
Remaining quantity
```

Podłącz w `position.tsx` obok trash buttona.

---

## 11. UI — Sell All symbol

Stwórz komponent:

```txt
src/app/dashboard/[walletId]/sell-all-symbol-dialog.tsx
```

Props:

```ts
walletId
companySymbol
companyName
positions
currency
currentPrice?
```

Dialog:

```txt
Sell all AAPL
Total quantity: X
Lots: N
Sell price per share
Total proceeds
Estimated realized P/L
[ ] Withdraw from sale proceeds
Withdrawal amount
```

Podłącz w:

```txt
src/app/dashboard/[walletId]/position-main.tsx
```

Zastąp obecny `Trash2 delete all` przyciskiem `Sell All`.

---

## 12. UI — Manual withdrawal

Stwórz komponent:

```txt
src/app/dashboard/[walletId]/withdraw-cash-dialog.tsx
```

Props:

```ts
walletId
cashBalance
currency
```

Dialog:

```txt
Available internal cash: X
Amount to withdraw
```

Validate client-side prosto, backend i tak waliduje.

Dodaj mały help/popup:

```txt
Internal cash = środki ze sprzedaży, które zostawiłeś w portfelu zamiast wypłacić.
Przy kolejnych zakupach aplikacja automatycznie używa ich najpierw,
a brakującą część traktuje jako nowy wkład.
```

Najprościej na start:
- mały `?` button otwierający `Dialog`
- albo native `title`

---

## 13. Wallet header

Plik:

```txt
src/app/dashboard/[walletId]/wallet-header.tsx
```

Pokaż najważniejsze:

```txt
Portfolio Value
Net Invested
Total P/L
Realized P/L
Unrealized P/L
```

Internal cash jako secondary:

```txt
Available cash: X
[Withdraw]
[?]
```

Nie rób z tego głównej metryki większej niż portfolio value.

---

## 14. Dashboard wallet cards

Pliki:

```txt
src/app/dashboard/wallet.tsx
src/app/dashboard/dashboard.tsx
```

Zmień naming:

```txt
totalCostBasis -> netInvested
```

Performance:

```ts
totalPl = totalValue - netInvested
totalPlPercent = netInvested > 0 ? totalPl / netInvested * 100 : null
```

Fallback gdy brak snapshotu:

```txt
totalValue = holdings cost fallback + cashBalance
netInvested = totalContributed - totalWithdrawn
```

---

## 15. Manual test scenarios

Po implementacji sprawdź te przypadki ręcznie.

### Scenario A — fresh BUY

```txt
cash = 0
BUY 10 x 100
```

Expected:

```txt
position quantity = 10
initialQuantity = 10
cashBalance = 0
totalBuyCost = 1000
totalContributed = 1000
netInvested = 1000
```

### Scenario B — partial SELL keep cash

```txt
SELL 4 x 120
withdraw = 0
```

Expected:

```txt
position quantity = 6
cashBalance = 480
realizedPl = 80
totalWithdrawn = 0
netInvested = 1000
portfolioValue = holdingsValue + 480
```

### Scenario C — BUY uses cash first

```txt
cashBalance = 480
BUY 2 x 100
```

Expected:

```txt
cashUsed = 200
externalContribution = 0
cashBalance = 280
totalBuyCost += 200
totalContributed unchanged
```

### Scenario D — BUY exceeds cash

```txt
cashBalance = 280
BUY 10 x 100
```

Expected:

```txt
cashUsed = 280
externalContribution = 720
cashBalance = 0
totalContributed += 720
```

### Scenario E — SELL with withdrawal

```txt
SELL proceeds = 500
withdrawal = 200
```

Expected:

```txt
cashBalance += 300
totalWithdrawn += 200
netInvested decreases by 200
```

### Scenario F — manual withdrawal too high

```txt
cashBalance = 100
withdraw 200
```

Expected:

```txt
validation error
no DB changes
```

### Scenario G — delete unsold lot

Expected:

```txt
position deleted
BUY transaction deleted
wallet aggregates reversed
```

### Scenario H — delete sold lot

Expected:

```txt
blocked
error message
no DB changes
```

---

## 16. Suggested implementation order

Najbezpieczniej:

1. Schema + migration.
2. Backfill script.
3. Types.
4. Queries.
5. Update `addPosition`.
6. Update `deletePosition`.
7. Add `sellPositionLot`.
8. Add `sellAllPositionsForSymbol`.
9. Add `withdrawCash`.
10. Update snapshot runner.
11. Update chart types/UI.
12. Update wallet stats/header.
13. Add Sell dialog per lot.
14. Add Sell All dialog.
15. Add Withdraw dialog.
16. Remove old Delete All UI.
17. Run:

```bash
npm run lint
npm run build
npm run cron:intraday
```

Startowałbym od kroków 1–5, bo wtedy po BUY już cały nowy model zaczyna żyć.
