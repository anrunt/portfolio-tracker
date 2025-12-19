"use client";

import { Button } from "@/components/ui/button";
import { searchTicker } from "@/server/actions/search-action";
import { useEffect, useRef, useState } from "react";
import { SearchResult } from "yahoo-finance2/modules/search";

export default function Search() {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<SearchResult>();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query) {
      searchTicker(query).then((result) => {
        console.log(result);
        setResults(result);
      })
    }
  }, [query])

  function printText(e: React.ChangeEvent<HTMLInputElement>) {
    clearTimeout(intervalRef.current!);

    const value = e.target.value;

    if (!value) {
      setQuery("");
      setResults(undefined);
      return;
    }

    intervalRef.current = setTimeout(() => {
      setQuery(value);
    }, 500);
  }

  function addCompany(symbol: string) {
    console.log("Selected Company: ", symbol);
  }

  const filteredQuotes = results?.quotes.filter(company => company.isYahooFinance);
  
  return (
    <>
      <input
        className="bg-black text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
        type="text"
        onChange={printText}
      />

      {results == null ? null : (
        filteredQuotes && filteredQuotes.length > 0 ? (
          <ul>
            {filteredQuotes.map(company => (
              <li key={String(company.symbol)}>
                <Button onClick={() => addCompany(company.symbol)}>
                  {String(company.shortname || company.symbol)}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div>No results</div>
        )
      )}
    </>
  )
}