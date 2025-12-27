"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { searchTicker } from "@/server/actions/dashboard-actions";
import { useEffect, useRef, useState } from "react";
import { SearchResult } from "yahoo-finance2/modules/search";
import AddPosition from "./add-position";

export default function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<SearchResult>();
  const [selectedCompany, setSelectedCompany] = useState<{name: string, symbol: string} | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query) {
      searchTicker(query).then((result) => {
        console.log(result);
        setResults(result);
      });
    }
  }, [query]);

  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setSelectedCompany(null);
        setQuery("");
        setResults(undefined);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open]);

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

  function addCompany(symbol: string, name: string) {
    console.log("Selected Company: ", symbol);
    setSelectedCompany({name, symbol});
    setResults(undefined);
  }

  const filteredQuotes = results?.quotes.filter((company) => company.isYahooFinance);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Search Company</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{selectedCompany ? "Add Position" : "Search Company"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!selectedCompany ? (
            <>
              <input
                className="bg-black text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500 w-full"
                type="text"
                placeholder="Enter company name or symbol..."
                onChange={printText}
              />

              {results == null ? null : filteredQuotes &&
                filteredQuotes.length > 0 ? (
                <ul className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                  {filteredQuotes.map((company) => (
                    <li key={String(company.symbol)}>
                      <Button
                        onClick={() => addCompany(company.symbol, company.longname || company.shortname || "")}
                        className="w-full flex justify-between items-center px-4"
                        variant="secondary"
                      >
                        <span className="text-left truncate">
                          {String(company.shortname || company.symbol)}
                        </span>
                        <span className="text-muted-foreground font-mono text-sm ml-4">
                          {company.symbol}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-center py-4">
                  No results
                </div>
              )}
            </>
          ) : (
            <AddPosition
              selectedCompany={selectedCompany}
              onBack={() => {
                setSelectedCompany(null);
                setQuery("");
              }}
              onClose={() => setOpen(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
