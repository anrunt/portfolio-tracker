export default function AddPosition({ symbol, onBack }: { symbol: string; onBack: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 hover:bg-muted rounded-md transition-colors"
          aria-label="Go back to search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Add position</h1>
      </div>
      <p className="text-muted-foreground">Selected company: <span className="font-mono">{symbol}</span></p>
    </>
  )
}