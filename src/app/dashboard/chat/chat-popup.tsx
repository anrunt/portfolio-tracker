"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  AlertCircleIcon,
  // CheckCircle2Icon, // TEMP DEBUG: used by the original compact tool status UI below.
  LoaderCircleIcon,
  MessageCircleIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

/* TEMP DEBUG: original compact tool status configuration.
const TOOL_STATUS_COPY = {
  getWalletsOverview: {
    pending: "Checking your wallets…",
    success: "Wallets checked",
    error: "Could not check wallets",
  },
  getWalletPositions: {
    pending: "Loading positions…",
    success: "Positions loaded",
    error: "Could not load positions",
  },
} as const;

type ToolName = keyof typeof TOOL_STATUS_COPY;
type ToolPhase = keyof (typeof TOOL_STATUS_COPY)[ToolName];
*/

export default function ChatPopup() {
  const params = useParams();
  const routeWalletId = params.walletId;
  const currentWalletId =
    typeof routeWalletId === "string" ? routeWalletId : undefined;
  const chatScope = currentWalletId
    ? `wallet:${currentWalletId}`
    : "dashboard";

  return (
    <ChatSession
      key={chatScope}
      currentWalletId={currentWalletId}
      hasCurrentWallet={Boolean(currentWalletId)}
    />
  );
}

function ChatSession({
  currentWalletId,
  hasCurrentWallet,
}: {
  currentWalletId?: string;
  hasCurrentWallet: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [transport] = React.useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          context: { currentWalletId },
        },
      }),
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isBusy) {
      return;
    }

    void sendMessage({ text });
    setInput("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="fixed right-4 bottom-4 z-40 size-14 rounded-full border border-foreground/10 shadow-[0_14px_40px_-12px_oklch(0.35_0.10_130/0.7)] transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
          size="icon"
          aria-label="Open portfolio assistant"
        >
          <MessageCircleIcon className="size-6" />
        </Button>
      </DialogTrigger>

      <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-105 flex-col gap-0 overflow-hidden border-border/80 bg-card/98 p-0 shadow-2xl sm:h-[min(40rem,calc(100dvh-3rem))] sm:w-full">
        <DialogHeader className="shrink-0 gap-1 border-b border-border/70 bg-secondary/35 px-5 py-4 pr-12 text-left">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <SparklesIcon className="size-3.5" />
            </span>
            <DialogTitle className="text-base tracking-tight">
              Portfolio assistant
            </DialogTitle>
          </div>
          <DialogDescription className="pl-9 text-xs leading-relaxed">
            {hasCurrentWallet
              ? "The wallet on this page is used as the default context."
              : "Ask about your wallets, values, and open positions."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1">
          <MessageScrollerProvider autoScroll>
            <MessageScroller>
              <MessageScrollerViewport className="custom-scrollbar">
                <MessageScrollerContent className="gap-4 px-4 py-5">
                  {messages.length === 0 && (
                    <div className="m-auto flex max-w-64 flex-col items-center gap-3 px-5 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl border border-border bg-secondary/45 text-secondary-foreground">
                        <MessageCircleIcon className="size-5" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Your portfolio, in context</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Ask a question to check wallet values or open positions.
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((message) => {
                    const align = message.role === "user" ? "end" : "start";

                    return (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={message.role === "user"}
                      >
                        <Message align={align}>
                          <MessageContent>
                            {message.parts.map((part, index) => {
                              const partKey = `${message.id}-${index}`;

                              if (part.type === "text" && part.text) {
                                return (
                                  <Bubble
                                    key={partKey}
                                    align={align}
                                    variant={
                                      message.role === "user" ? "default" : "muted"
                                    }
                                  >
                                    <BubbleContent className="whitespace-pre-wrap">
                                      {part.text}
                                    </BubbleContent>
                                  </Bubble>
                                );
                              }

                              if (
                                part.type.startsWith("tool-") ||
                                part.type === "dynamic-tool"
                              ) {
                                return (
                                  <ToolCallDebug key={partKey} part={part} />
                                );
                              }

                              /* TEMP DEBUG: original compact tool status UI.
                              if (part.type === "tool-getWalletsOverview") {
                                return (
                                  <ToolStatusRow
                                    key={partKey}
                                    toolName="getWalletsOverview"
                                    state={part.state}
                                  />
                                );
                              }

                              if (part.type === "tool-getWalletPositions") {
                                return (
                                  <ToolStatusRow
                                    key={partKey}
                                    toolName="getWalletPositions"
                                    state={part.state}
                                  />
                                );
                              }
                              */

                              return null;
                            })}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    );
                  })}

                  {status === "submitted" && (
                    <div
                      className="flex w-fit items-center gap-2 rounded-full border border-border bg-secondary/35 px-3 py-2 text-xs text-muted-foreground"
                      role="status"
                    >
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                      Thinking…
                    </div>
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton aria-label="Scroll to latest message" />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>

        {error && (
          <div
            className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            <AlertCircleIcon className="size-4 shrink-0" />
            Could not generate a response. Please try again.
          </div>
        )}

        <form
          className="flex shrink-0 items-center gap-2 border-t border-border/70 bg-background/90 p-3"
          onSubmit={handleSubmit}
        >
          <input
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60"
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Ask about your portfolio…"
            aria-label="Message portfolio assistant"
            autoComplete="off"
            disabled={isBusy}
          />
          <Button
            className="size-10 rounded-lg"
            type="submit"
            size="icon"
            disabled={isBusy || input.trim().length === 0}
            aria-label="Send message"
          >
            {isBusy ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SendIcon />
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToolCallDebug({ part }: { part: unknown }) {
  const toolType = getDebugField(part, "type") ?? "tool";
  const toolName =
    toolType === "dynamic-tool"
      ? (getDebugField(part, "toolName") ?? toolType)
      : toolType.replace(/^tool-/, "");
  const state = getDebugField(part, "state");

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-primary/45 bg-secondary/25 text-xs shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-primary/25 bg-primary/10 px-3 py-2">
        <span className="font-semibold text-foreground">TEMP tool call</span>
        <code className="rounded bg-background/70 px-1.5 py-0.5 text-secondary-foreground">
          {toolName}
        </code>
        {state && (
          <span className="ml-auto rounded-full border border-border bg-background/70 px-2 py-0.5 text-muted-foreground">
            {state}
          </span>
        )}
      </div>
      <pre className="custom-scrollbar overflow-x-auto whitespace-pre-wrap p-3 font-mono leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {formatToolCall(part)}
      </pre>
    </div>
  );
}

function getDebugField(value: unknown, field: string): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    field in value &&
    typeof (value as Record<string, unknown>)[field] === "string"
  ) {
    return (value as Record<string, string>)[field];
  }

  return undefined;
}

function formatToolCall(part: unknown): string {
  try {
    return JSON.stringify(part, null, 2) ?? String(part);
  } catch {
    return String(part);
  }
}

/* TEMP DEBUG: original compact tool status components.
function ToolStatusRow({
  toolName,
  state,
}: {
  toolName: ToolName;
  state: string;
}) {
  const phase = getToolPhase(state);
  if (!phase) {
    return null;
  }

  const copy = TOOL_STATUS_COPY[toolName][phase];

  return (
    <div
      className="flex w-fit items-center gap-2 rounded-full border border-border/80 bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground"
      role="status"
    >
      <ToolStatusIcon phase={phase} />
      <span>{copy}</span>
    </div>
  );
}

function getToolPhase(state: string): ToolPhase | null {
  if (state === "input-streaming" || state === "input-available") {
    return "pending";
  }

  if (state === "output-available") {
    return "success";
  }

  if (state === "output-error") {
    return "error";
  }

  return null;
}

function ToolStatusIcon({ phase }: { phase: ToolPhase }) {
  if (phase === "pending") {
    return <LoaderCircleIcon className="size-3.5 animate-spin" />;
  }

  if (phase === "success") {
    return <CheckCircle2Icon className="size-3.5 text-accent" />;
  }

  return <AlertCircleIcon className="size-3.5 text-destructive" />;
}
*/
