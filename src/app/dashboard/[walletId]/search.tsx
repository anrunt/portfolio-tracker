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
import type { FinnhubStock } from "@/server/actions/types";
import { useEffect, useRef, useState } from "react";
import AddPosition from "./add-position";

interface SearchProps {
  exchange: string;
}

export default function Search({ exchange }: SearchProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<FinnhubStock[] | undefined>();
  const [selectedCompany, setSelectedCompany] = useState<{name: string, symbol: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query) return;

    let ignore = false;

    searchTicker(query, exchange)
      .then((result) => {
        if (ignore) return;
        
        if (result.status === "ok") {
          setResults(result.value);
          setError(null);
        } else {
          console.error("Search failed:", result.error);
          setError(result.error.message);
          setResults(undefined);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [query, exchange]);

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    
    if (!newOpen) {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      // For allowing animation to complete
      resetTimeoutRef.current = setTimeout(() => {
        setSelectedCompany(null);
        setQuery("");
        setResults(undefined);
        setError(null);
      }, 200);
    } else {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    }
  }

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                className="bg-card text-card-foreground border border-border rounded-md px-3 h-9 text-sm focus:outline-none focus:border-primary w-full"
                type="text"
                placeholder="Enter company name or symbol..."
                onChange={printText}
              />

              {error && !isLoading && (
                <div className="text-red-500 text-center py-2">
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="flex justify-center py-2">
                  <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
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
              onClose={() => handleOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
