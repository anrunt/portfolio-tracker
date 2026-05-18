-[x] Fix Delete position popup styling
-[x] Slightly different color theme for positions showcase
-[x] Add some outline for the positions showcase
-[x] Redesing dark-mode
-[x] FEATURE: So its quite tedious to type every position if someone is new to the app so i think i should add a option to
add multiple positions for the same company from the Add Position dialog.
-[x] FEATURE: Realtime prices via finnhub api
  -[x] Fetch prices on server
  -[x] Show P/L
  -[x] Auto refresh every 60s (Tanstack Query)
  -[x] Polish stock exchange (stoq api)
-[x] Add renaming wallets
-[x] FEATURE: Portfolio progress chart -> /dashboard and /dashboard/walletId for independent wallets
  -[x] Added cron portfolsio snapshots
  -[x] Added charts
-[x] FEATURE: Soft-deleting wallets -> now when user deletes wallet, all snapshots are deleted which is not an expected behavior due to fact that we want to preserve portfolio historic performance and still show it on charts even though the wallet was deleted
  -[x] Add a deleted_at flag to wallet table -> null (not deleted) | date (deleted)
  -[x] Update wallet deletion logic from db.delete to db.update
  -[x] Update the queries to exclude soft deleted wallets
-[x] FIX: Total value is shown in no PLN or USD it just adds two currencies together which is wrong -> make so user can choose what currency he wants to see total value of his portfolio
  •[x] If all records have walletCurrency === displayCurrency, we don't need to fetch FX rates.
  •[x] Add button to change in which currency user wants to see his portfolio.
-[x] FIX: If one symbol fails the wallet gets skipped which makes a terrible drop on the chart ui which is really misleading for the user.
-[x] FIX: When the dashboard page loads first, the data is outdated so user needs to refresh to see latest data - only happens for USA.
-[x] Feature: In the wallets section in the main dashboard, add P/L so user doesnt have to go inside his wallet to see how it is performing
-[x] Feature: Add retry for stoq price fetching
-[] Feature: Add delete all positions button so i can delete all my positions on one company with ease.
-[] Feature: Think about better cost basis - when i close the position and reopen a new one, my cost basis is not accurate because if i lose money on some position i cant see how much i've spent overall but i see only how much i've spent on current shares only.
-[] Feature: Maybe make a portfolio snapshot when user adds new company so he can see his new chart instead of waiting for the snapshot?
