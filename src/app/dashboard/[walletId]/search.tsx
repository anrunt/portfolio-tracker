"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { searchTicker, FinnhubStock } from "@/server/actions/dashboard-actions";
import { useEffect, useRef, useState } from "react";
import AddPosition from "./add-position";

export default function Search() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<FinnhubStock[] | undefined>();
  const [selectedCompany, setSelectedCompany] = useState<{name: string, symbol: string} | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query) {
      searchTicker(query).then((result) => {
        console.log(result);
        setResults(result);
      }).finally(() => {setIsLoading(false)});
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
      setIsLoading(true);
      setQuery(value);
    }, 500);
  }

  function addCompany(symbol: string, name: string) {
    console.log("Selected Company: ", symbol);
    setSelectedCompany({name, symbol});
    setResults(undefined);
  }

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

              {isLoading && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {!isLoading && results != null && (results.length > 0 ? (
                <ul className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
                  {results.map((company) => (
                    <li key={company.symbol}>
                      <Button
                        onClick={() => addCompany(company.symbol, company.description)}
                        className="w-full flex justify-between items-center px-4"
                        variant="secondary"
                      >
                        <span className="text-left truncate">
                          {company.description || company.symbol}
                        </span>
                        <span className="text-muted-foreground font-mono text-sm ml-4">
                          {company.displaySymbol}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-muted-foreground text-center py-4">
                  No results
                </div>
              ))}
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
