## Cel feature

Rozwijamy obecny `getAllWalletsPositions` i zmieniamy go w `getHoldingsAnalysis`.

Tool będzie:

- pobierał wszystkie otwarte Holdingi,
- agregował partie zakupu,
- pobierał aktualne Market Prices,
- obliczał wartość i niezrealizowany P/L,
- obliczał udział Holdingu w łącznej wartości wszystkich akcji w Portfolio, całkowicie pomijając gotówkę,
- informował o brakujących cenach.

Tool nie będzie miał wymaganych argumentów.

---

## 1. Pobieramy pozycje z bazy

Korzystamy z `QUERIES.getUserWalletsWithPositions(userId)`.

Do wewnętrznych danych Walleta potrzebujemy:

- `id` — do grupowania, nie zwracamy go modelowi,
- `name`,
- `currency`,
- otwarte pozycje.

Nie pobieramy ani nie wykorzystujemy `cashBalance`. Udział pozycji liczymy wyłącznie względem łącznej wartości akcji.

---

## 2. Agregujemy partie zakupu

Grupujemy dane najpierw według Walleta, a następnie według Company Symbol.

Dla każdej spółki otrzymujemy:

- `symbol`,
- `companyName`,
- `quantity`,
- `averagePurchasePrice`,
- `costBasis`.

Obliczenia:

```txt
quantity = suma pozostałych ilości ze wszystkich otwartych partii

costBasis = suma(quantity partii × pricePerShare partii)

averagePurchasePrice = costBasis / quantity
```

Na tym etapie mamy wewnętrzną strukturę:

```txt
Wallet
  id
  name
  currency
  positions[]
```

`id` jest potrzebne do stabilnego grupowania, ale nie trafia do finalnej odpowiedzi.

---

## 3. Budujemy zbiory symboli

Przechodzimy przez zagregowane Wallety i budujemy:

```ts
const US_Symbols = new Set<string>();
const WA_Symbols = new Set<string>();
```

Według obecnych zasad projektu:

```txt
Wallet USD → US_Symbols
Wallet PLN → WA_Symbols
```

Sety zapobiegają wielokrotnemu pobieraniu ceny tej samej spółki znajdującej się w kilku Walletach.

---

## 4. Pobieramy Market Prices

Generujemy jeden `operationId` dla całego wykonania toola.

Następnie równolegle wywołujemy `getPrices()`:

```txt
US symbols → exchange: "US"
WA symbols → exchange: "WA"
mode → "user-refresh"
```

Używamy bezpośrednio `getPrices()`, a nie:

- `usePrices`,
- `/api/stock`,
- server action `getPrice`.

Tryb `user-refresh` automatycznie wykorzysta Redis cache.

---

## 5. Normalizujemy wyniki `getPrices`

Tworzymy mapę udanych cen z kluczem uwzględniającym giełdę:

```txt
US:AAPL → MarketPrice
WA:XTB.WA → MarketPrice
```

Osobno budujemy Set niedostępnych symboli.

### Jeżeli całe wywołanie zwróci `Result.Err`

Wszystkie symbole z tej giełdy oznaczamy jako niedostępne.

### Jeżeli wywołanie zwróci `Result.Ok`

- elementy `prices` dodajemy do mapy,
- symbole z `failures` dodajemy do niedostępnych symboli.

Dodatkowo defensywnie sprawdzamy, czy każdy wymagany symbol znalazł się w mapie. Jeśli nie, traktujemy go jako niedostępny nawet wtedy, gdy nie pojawił się w `failures`.

Nie przekazujemy modelowi technicznego `failure.reason`.

---

## 6. Łączymy Holdingi z Market Prices

Iterujemy po zagregowanych Holdingach, a nie po tablicy cen ani failures.

Dla każdego Holdingu szukamy ceny w mapie.

### Jeżeli Market Price jest dostępna

Obliczamy:

```txt
currentValue = quantity × marketPrice

unrealizedPl = currentValue - costBasis

unrealizedPlPercent =
  costBasis > 0
    ? unrealizedPl / costBasis × 100
    : niedostępne
```

Tworzymy:

```txt
marketData.status = available
marketPrice
currentValue
unrealizedPl
unrealizedPlPercent
fetchedAt
```

Wszystkie te wartości pozostają w walucie Walleta.

### Jeżeli Market Price jest niedostępna

Nie usuwamy Holdingu.

Zwracamy jego dane z bazy oraz:

```txt
marketData.status = unavailable
```

Nie używamy średniej ceny zakupu jako zastępczej Market Price.

---

## 7. Ustalamy `priceCoverage`

Po połączeniu wszystkich pozycji z cenami określamy stan całej analizy:

```txt
complete
```

Wszystkie wymagane ceny są dostępne.

```txt
partial
```

Dostępna jest tylko część wymaganych cen.

```txt
unavailable
```

Istnieją Holdingi, ale nie udało się pobrać żadnej ceny.

Jeżeli użytkownik nie ma żadnych otwartych Holdingów, możemy zwrócić:

```txt
priceCoverage: complete
unavailableSymbols: []
```

Nie było wtedy żadnych cen do pobrania.

---

## 8. Obliczamy udział Holdingów w wartości wszystkich akcji

Udział liczymy wyłącznie względem aktualnej wartości wszystkich akcji we wszystkich Walletach:

```txt
wszystkie Holdingi we wszystkich Walletach
```

Całkowicie pomijamy gotówkę. `cashBalance` nie jest pobierane ani używane w obliczeniach.

Jeżeli użytkownik ma Holdingi zarówno w PLN, jak i USD, pobieramy:

- `displayCurrency` użytkownika,
- aktualny kurs USD/PLN.

Jeżeli wszystkie Holdingi są w jednej walucie, pobieranie kursu FX nie jest potrzebne.

Wartości wymagające przeliczenia normalizujemy wewnętrznie:

```txt
USD → PLN: wartość × kurs
PLN → USD: wartość / kurs
```

Następnie:

```txt
totalHoldingsValue =
  suma przeliczonych currentValue wszystkich Holdingów

portfolioWeightPercent =
  przeliczona currentValue Holdingu
  / totalHoldingsValue
  × 100
```

Przy pełnych danych suma `portfolioWeightPercent` wszystkich Holdingów powinna wynosić około 100%, z uwzględnieniem różnic wynikających z precyzji liczb.

Dane pomocnicze, takie jak:

- `displayCurrency`,
- kurs FX,
- `totalHoldingsValue`,

nie trafiają do finalnej odpowiedzi toola.

### Gdy brakuje przynajmniej jednej ceny

Nie znamy pełnej wartości wszystkich Holdingów, dlatego:

```txt
portfolioWeightPercent = null
```

dla wszystkich Holdingów, również tych posiadających cenę.

Nie obliczamy udziałów na podstawie niepełnego zbioru akcji.

---

## 9. Budujemy finalną odpowiedź

Zwracamy tylko uzgodniony kontrakt:

```ts
type GetHoldingsAnalysisOutput = {
  status: "success";
  priceCoverage: "complete" | "partial" | "unavailable";
  unavailableSymbols: string[];
  wallets: {
    name: string;
    currency: "USD" | "PLN";
    positions: AnalyzedHolding[];
  }[];
};
```

Każdy Holding zawiera dane podstawowe oraz jeden z wariantów:

```txt
marketData.status = available
```

albo:

```txt
marketData.status = unavailable
```

Nie zwracamy:

- `walletId`,
- kursu FX,
- technicznych powodów failures,
- surowych partii zakupu.

---

## 10. Podmieniamy obecny tool

W `src/app/api/chat/route.ts`:

1. zmieniamy `getAllWalletsPositions` na `getHoldingsAnalysis`,
2. pozostawiamy pusty input schema,
3. podłączamy nowy przepływ pobierania i obliczania danych,
4. aktualizujemy opis toola.

Opis powinien jasno mówić, że tool służy do:

- listowania Holdingów,
- sprawdzania Market Prices,
- analizy P/L pozycji,
- znajdowania najlepszych i najgorszych pozycji,
- analizy udziału oraz koncentracji.

Nie powinien być używany do:

- ogólnej wartości Walletów,
- historii kupna i sprzedaży.

---

## 11. Aktualizujemy system prompt i UI

W system prompt usuwamy odwołania do:

- `getAllWalletsPositions`,
- nieistniejącego `getWalletPositions`.

Dodajemy prostą regułę:

```txt
Pytania o spółki, Holdingi, ceny, P/L pozycji,
alokację lub koncentrację → getHoldingsAnalysis
```

W `chat-popup.tsx` dodajemy bezpieczny status:

```txt
pending → „Analizuję pozycje…”
success → „Pozycje przeanalizowane”
error   → „Nie udało się przeanalizować pozycji”
```

Nie pokazujemy surowego inputu ani outputu toola.

Usuwamy również serwerowe `console.log(toolResults)`.

---

## 12. Sprawdzamy przypadki brzegowe

Na końcu ręcznie sprawdzamy:

1. wszystkie ceny dostępne,
2. jedna cena niedostępna,
3. wszystkie ceny niedostępne,
4. tylko Wallety USD,
5. tylko Wallety PLN,
6. jednocześnie Wallety USD i PLN,
7. ten sam symbol w kilku Walletach,
8. Wallet bez pozycji,
9. użytkownik bez żadnych Holdingów,
10. cache hit i cache miss.

Następnie uruchamiamy:

```bash
npm run lint
npm run build
```

Najważniejsza kolejność implementacji:

```txt
query
→ agregacja partii
→ Sety symboli
→ getPrices
→ mapa cen i failures
→ wzbogacenie Holdingów
→ FX i udziały
→ finalny return
→ podmiana toola
→ prompt i UI
→ sprawdzenie przypadków brzegowych
```
