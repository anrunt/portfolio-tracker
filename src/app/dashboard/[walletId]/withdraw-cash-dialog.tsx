"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowUpFromLine, CircleHelp } from "lucide-react";
import { withdrawCash } from "@/server/actions/dashboard/wallet-actions";

interface WithdrawCashDialogProps {
  walletId: string;
  cashBalance: number;
  currency: string;
}

const initialState = {
  message: "",
  success: false,
  timestamp: 0,
  fieldErrors: undefined,
};

export default function WithdrawCashDialog({
  walletId,
  cashBalance,
  currency,
}: WithdrawCashDialogProps) {
  const [open, setOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const withdrawCashWithWalletId = withdrawCash.bind(null, walletId);
  const [state, formAction, pending] = useActionState(withdrawCashWithWalletId, initialState);

  const parsedWithdrawAmount = Number(withdrawAmount);
  const hasAmount = withdrawAmount.trim().length > 0;
  const hasValidAmount = Number.isFinite(parsedWithdrawAmount) && parsedWithdrawAmount > 0;

  const amountWarning = hasAmount && !hasValidAmount
    ? "Withdrawal amount must be greater than 0"
    : hasValidAmount && parsedWithdrawAmount > cashBalance
      ? "Withdrawal amount cannot exceed cash balance"
      : undefined;

  const cashLeftAfterWithdrawal = hasValidAmount
    ? Math.max(cashBalance - parsedWithdrawAmount, 0)
    : cashBalance;

  const locale = currency === "USD" ? "en-US" : "pl-PL";

  const formatNumber = (value: number) =>
    value.toLocaleString(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  useEffect(() => {
    if (state.success === true && state.timestamp !== 0) {
      startTransition(() => {
        setOpen(false);
        setWithdrawAmount("");
      });
    }
  }, [state.success, state.timestamp]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={cashBalance <= 0}
          className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border border-primary/35 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-primary/10 disabled:hover:border-primary/35 flex items-center gap-1.5"
          aria-label="Withdraw internal cash"
        >
          Withdraw
          <ArrowUpFromLine className="size-3" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-115 bg-background border-border/50 p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-(family-name:--font-jb-mono) text-sm font-bold tracking-wide text-foreground">
            WITHDRAW_CASH
          </DialogTitle>
          <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-wider mt-1">
            Move internal cash out of this wallet.
          </p>
        </DialogHeader>

        <form action={formAction} className="px-6 pt-4 pb-6 space-y-4">
          <div className="rounded border border-border/60 bg-muted/20 px-4 py-3">
            <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Available internal cash
            </p>
            <p className="font-(family-name:--font-jb-mono) text-lg tabular-nums text-foreground mt-1 font-semibold">
              {formatNumber(cashBalance)} <span className="text-[10px] text-muted-foreground font-semibold">{currency}</span>
            </p>
          </div>

          <label className="space-y-1.5 block">
            <span className="font-(family-name:--font-jb-mono) text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Amount to withdraw
            </span>
            <input
              name="withdrawAmount"
              type="number"
              step="any"
              min="0"
              max={cashBalance}
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded border border-border bg-background px-3 py-2 font-(family-name:--font-jb-mono) text-[12px] tabular-nums outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
            {(state.fieldErrors?.withdrawAmount || amountWarning) && (
              <p className="font-(family-name:--font-jb-mono) text-[10px] text-destructive">
                {state.fieldErrors?.withdrawAmount ?? amountWarning}
              </p>
            )}
          </label>

          <div className="rounded border border-border/60 bg-card/40 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border/50">
              <div className="px-3 py-3">
                <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Withdrawal
                </p>
                <p className="font-(family-name:--font-jb-mono) text-[13px] tabular-nums text-foreground mt-1">
                  {formatNumber(hasValidAmount ? parsedWithdrawAmount : 0)} <span className="text-[9px] text-muted-foreground font-semibold">{currency}</span>
                </p>
              </div>
              <div className="px-3 py-3">
                <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Cash after
                </p>
                <p className="font-(family-name:--font-jb-mono) text-[13px] tabular-nums text-foreground mt-1">
                  {formatNumber(cashLeftAfterWithdrawal)} <span className="text-[9px] text-muted-foreground font-semibold">{currency}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded border border-primary/20 bg-primary/5 px-4 py-3 flex gap-3">
            <CircleHelp className="size-4 text-primary mt-0.5 shrink-0" />
            <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground leading-relaxed">
              Internal cash means proceeds from sales that stayed in this wallet instead of being withdrawn.
              Future buys automatically use this cash first, and only the missing part is treated as a new contribution.
            </p>
          </div>

          {state.message && !state.success && (
            <div className="rounded border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive leading-relaxed">
                {state.message}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
            <DialogClose asChild>
              <button
                type="button"
                disabled={pending}
                className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={pending || !hasValidAmount || parsedWithdrawAmount > cashBalance}
              className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {pending ? "Withdrawing..." : "Withdraw"}
              <ArrowUpFromLine className="size-3" />
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
