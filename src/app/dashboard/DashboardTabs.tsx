"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/new", label: "New Consultation" },
  { href: "/dashboard/transcripts", label: "Transcripts" },
];

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
