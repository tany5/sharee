"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/** Print helper for the invoice pages (browser Print → Save as PDF). */
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer size={15} /> {label}
    </Button>
  );
}
