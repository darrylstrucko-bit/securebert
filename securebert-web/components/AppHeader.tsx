import Image from "next/image";
import Link from "next/link";

// Shared by the landing page and every use-case page (via UseCaseShell) so the
// title bar never visibly changes shape between them -- previously the landing
// page had its own larger header while use-case pages had a smaller, abbreviated
// one, which read as two different apps.
export function AppHeader({ pageTitle }: { pageTitle?: string }) {
  return (
    <div className="max-w-[1600px] mx-auto px-6 py-5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <Image src="/app-logo.svg" alt="" width={40} height={40} className="h-9 w-9 sm:h-10 sm:w-10" />
        <span className="text-lg sm:text-xl font-semibold leading-none">
          SecureBERT 2.0 for Security Operations
        </span>
      </Link>
      {pageTitle && (
        <>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-accent hover:underline shrink-0 whitespace-nowrap border border-accent/30 rounded-full px-2.5 py-1 ml-3"
          >
            &larr; All use cases
          </Link>
          <span className="text-muted shrink-0 hidden sm:inline">/</span>
          <span className="text-base sm:text-lg font-semibold leading-none min-w-0 truncate">
            {pageTitle}
          </span>
        </>
      )}
    </div>
  );
}
