"use client";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        <button
          className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm md:hidden"
          onClick={onMenu}
        >
          Menu
        </button>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-muted-foreground">
            NL360 Escritorio
          </div>
          <div className="truncate font-medium">Home</div>
        </div>

        <div className="text-sm text-muted-foreground hidden sm:block">
          Estado: <span className="text-foreground">v1 setup</span>
        </div>
      </div>
    </header>
  );
}
