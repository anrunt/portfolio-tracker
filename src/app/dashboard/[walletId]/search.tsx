"use client";

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
import { Plus } from "lucide-react";
import AddPosition from "./add-position";

interface SearchProps {
  exchange: string;
}

export default function Search({ exchange }: SearchProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<FinnhubStock[] | undefined>();
  const [selectedCompany, setSelectedCompany] = useState<{
    name: string;
    symbol: string;
  } | null>(null);
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
    setSelectedCompany({ name, symbol });
    setResults(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all duration-150 cursor-pointer">
          <Plus className="size-3" />
          <span className="font-(family-name:--font-jb-mono) text-[10px] font-semibold tracking-[0.15em] uppercase">
            Add Position
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[425px] bg-background border-border/50 p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-(family-name:--font-jb-mono) text-sm font-bold tracking-wide text-foreground">
            {selectedCompany ? "ADD_POSITION" : "SEARCH_COMPANY"}
          </DialogTitle>
          <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-wider mt-1">
            {selectedCompany
              ? `Adding to ${selectedCompany.symbol}`
              : "Find a company to add to your portfolio"}
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
          {!selectedCompany ? (
            <>
              <input
                className="font-(family-name:--font-jb-mono) text-[12px] bg-card text-foreground border border-border rounded px-3 py-2 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 w-full transition-all duration-150 placeholder:text-muted-foreground/30"
                type="text"
                placeholder="enter_company_name..."
                onChange={printText}
              />

              {error && !isLoading && (
                <div className="font-(family-name:--font-jb-mono) text-[11px] text-destructive text-center py-2 tracking-wider">
                  ERROR: {error}
                </div>
              )}

              {isLoading && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
                </div>
              )}

              {!isLoading &&
                results != null &&
                (results.length > 0 ? (
                  <ul className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2 -mr-2">
                    {results.map((company, index) => {
                      const text = company.description || company.symbol;
                      const truncatedText =
                        text.length > 30 ? text.slice(0, 30) + "..." : text;
                      return (
                        <li key={`${company.symbol}-${index}`}>
                          <button
                            onClick={() =>
                              addCompany(company.symbol, company.description)
                            }
                            className="w-full flex justify-between items-center px-3 py-2 rounded border border-border/50 bg-card/40 hover:border-primary/30 hover:bg-primary/5 transition-all duration-150 cursor-pointer"
                          >
                            <span className="font-(family-name:--font-jb-mono) text-[11px] text-foreground text-left truncate">
                              {truncatedText}
                            </span>
                            <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground ml-4 tabular-nums">
                              {company.displaySymbol}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="font-(family-name:--font-jb-mono) text-[11px] text-muted-foreground/40 text-center py-2 tracking-wider">
                    NO_RESULTS
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
