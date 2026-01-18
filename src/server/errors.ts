import { TaggedError } from "better-result";

/**
 * User is not authenticated (no session).
 */
export class UnauthenticatedError extends TaggedError("UnauthenticatedError")<{
  message: string;
}>() {
  constructor() {
    super({ message: "User is not authenticated" });
  }
}

/**
 * User is authenticated but not authorized for this action.
 */
export class UnauthorizedError extends TaggedError("UnauthorizedError")<{
  message: string;
  resource?: string;
}>() {
  constructor(args: { resource?: string } = {}) {
    super({
      ...args,
      message: args.resource
        ? `Not authorized to access ${args.resource}`
        : "Not authorized for this action",
    });
  }
}

/**
 * Requested resource was not found.
 */
export class NotFoundError extends TaggedError("NotFoundError")<{
  resource: string;
  id?: string;
  message: string;
}>() {
  constructor(args: { resource: string; id?: string }) {
    super({
      ...args,
      message: args.id
        ? `${args.resource} not found: ${args.id}`
        : `${args.resource} not found`,
    });
  }
}

/**
 * Validation error from schema parsing or business rules.
 */
export class ValidationError extends TaggedError("ValidationError")<{
  field?: string;
  message: string;
}>() {}

/**
 * Configuration error (e.g., missing API key).
 */
export class ConfigError extends TaggedError("ConfigError")<{
  key: string;
  message: string;
}>() {
  constructor(args: { key: string }) {
    super({
      ...args,
      message: `Missing configuration: ${args.key}`,
    });
  }
}

/**
 * External API error (e.g., Finnhub).
 */
export class ApiError extends TaggedError("ApiError")<{
  service: string;
  status?: number;
  message: string;
  cause?: unknown;
}>() {
  constructor(args: { service: string; status?: number; cause?: unknown }) {
    const statusPart = args.status ? ` (${args.status})` : "";
    const causePart =
      args.cause instanceof Error ? `: ${args.cause.message}` : "";
    super({
      ...args,
      message: `${args.service} API error${statusPart}${causePart}`,
    });
  }
}

/**
 * Database operation error.
 */
export class DatabaseError extends TaggedError("DatabaseError")<{
  operation: string;
  message: string;
  cause: unknown;
}>() {
  constructor(args: { operation: string; cause: unknown }) {
    const causeMsg =
      args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({
      ...args,
      message: `Database ${args.operation} failed: ${causeMsg}`,
    });
  }
}

// Error union types for server actions
export type AuthError = UnauthenticatedError | UnauthorizedError;

export type SearchTickerError =
  | UnauthenticatedError
  | ConfigError
  | ValidationError
  | ApiError;

export type WalletError =
  | UnauthenticatedError
  | NotFoundError
  | ValidationError
  | DatabaseError;

export type PositionError =
  | UnauthenticatedError
  | UnauthorizedError
  | NotFoundError
  | ValidationError
  | DatabaseError;
