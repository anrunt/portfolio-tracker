# Portfolio Tracker

Portfolio Tracker tracks wallet holdings and portfolio value over time using market prices and currency rates.

## Language

**Wallet**:
A user-owned container for cash balance, holdings, contributions, withdrawals, and performance history.
_Avoid_: Account, portfolio account

**Holding**:
The remaining quantity of a company position currently owned inside a wallet.
_Avoid_: Stock row, asset line

**Company Symbol**:
The canonical identifier for a listed company inside the app. GPW company symbols include the `.WA` suffix, for example `XTB.WA`.
_Avoid_: Ticker without exchange suffix for GPW holdings

**Market Price**:
The current or recent external price for a company symbol used to value holdings.
_Avoid_: Quote, stock value

**User Price Refresh**:
A price lookup requested while a user is viewing or interacting with a wallet. It supports the user experience rather than historical performance records.
_Avoid_: Dashboard quote fetch, frontend price fetch

**Snapshot Price Fetch**:
A price lookup used to create a dated performance record for wallets. It represents the market input for a snapshot.
_Avoid_: Cron price refresh, background quote fetch

**Snapshot**:
A complete recorded wallet valuation at a point in time or for a specific day, used for performance charts and history. A snapshot should not be created from partial market prices because that would misrepresent wallet performance.
_Avoid_: Backup, checkpoint, partial valuation

## Example dialogue

Developer: "The dashboard needs fresh market prices. Is that a Snapshot Price Fetch?"

Domain expert: "No. If the user is just viewing a wallet, call it a User Price Refresh. It may be optimized for responsiveness."

Developer: "When the scheduled job records wallet values for charts, what is that?"

Domain expert: "That is a Snapshot. The market prices used for it come from a Snapshot Price Fetch."
