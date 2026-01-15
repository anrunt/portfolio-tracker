"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchTicker, FinnhubStock } from "@/server/actions/dashboard-actions";
import { useEffect, useRef, useState } from "react";
import AddPosition from "./add-position";

export default function Search() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<FinnhubStock[] | undefined>();
  const [selectedCompany, setSelectedCompany] = useState<{name: string, symbol: string} | null>(null);
  const [exchange, setExchange] = useState<string>("US");
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (query) {
      searchTicker(query, exchange)
        .then((result) => {
          console.log(result);
          setResults(result);
          setError(null);
        })
        .catch((err) => {
          console.error("Search failed:", err);
          setError("Failed to search. Please try again.");
          setResults(undefined);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [query, exchange]);

  useEffect(() => {
    if (!open) {
      const timeout = setTimeout(() => {
        setSelectedCompany(null);
        setQuery("");
        setResults(undefined);
        setError(null);
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
              <div className="flex gap-2 items-center">
                <input
                  className="bg-black text-white border border-gray-700 rounded-md px-3 h-9 text-sm focus:outline-none focus:border-blue-500 w-full"
                  type="text"
                  placeholder="Enter company name or symbol..."
                  onChange={printText}
                />
                <Select value={exchange} onValueChange={setExchange}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Ex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">US</SelectItem>
                    <SelectItem value="WA">WA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && !isLoading && (
                <div className="text-red-500 text-center py-2">
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="flex justify-center py-2">
                  <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {!isLoading && results != null && (results.length > 0 ? (
                <ul className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2 -mr-2">
                  {results.map((company, index) => {
                    const text = company.description || company.symbol;
                    const truncatedText = text.length > 30 ? text.slice(0, 30) + "..." : text;
                    return (
                    <li key={`${company.symbol}-${index}`}>
                      <Button
                        onClick={() => addCompany(company.symbol, company.description)}
                        className="w-full flex justify-between items-center px-4"
                        variant="secondary"
                      >
                        <span className="text-left truncate">
                          {truncatedText}
                        </span>
                        <span className="text-muted-foreground font-mono text-sm ml-4">
                          {company.displaySymbol}
                        </span>
                      </Button>
                    </li>
                  )})}
                </ul>
              ) : (
                <div className="text-muted-foreground text-center py-2">
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
