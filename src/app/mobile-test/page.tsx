import type { Metadata } from "next";
import { MobileTestPanel } from "@/components/features/mobile-test-panel";

export const metadata: Metadata = {
  title: "Mobile test",
  robots: { index: false, follow: false },
};

/** Quick navigation + viewport readout for testing on a real phone. Public route: /mobile-test */
export default function MobileTestPage() {
  return <MobileTestPanel />;
}
