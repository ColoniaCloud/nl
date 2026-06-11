import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh text-zinc-100 flex flex-col">
      <PublicHeader />
      {/* pt accounts for floating header (~72px) */}
      <main className="pt-24 flex-1">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6">
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
