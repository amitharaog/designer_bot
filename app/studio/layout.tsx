import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Aangan Studio · Phone agent", robots: { index: false } };

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
