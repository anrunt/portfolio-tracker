export default function PriceSkeleton() {
  return (
    <span role="status" className="inline-block h-4 w-20 animate-pulse rounded bg-muted align-middle">
      <span className="sr-only">Loading price</span>
    </span>
  );
}
