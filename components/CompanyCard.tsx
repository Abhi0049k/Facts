import { Building2, Calendar, CircleDollarSign, Users } from "lucide-react";
import type { CompanyProfile } from "@/lib/types";

interface CompanyCardProps {
  company: CompanyProfile;
  featured?: boolean;
}

export function CompanyCard({ company, featured = false }: CompanyCardProps) {
  return (
    <article
      className={`rounded-md border bg-panel p-5 shadow-panel ${
        featured ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{company.name}</h3>
          <p className="text-sm text-neutral-500">{company.domain}</p>
        </div>
        <span className="rounded-md border border-line px-2 py-1 text-xs font-medium text-neutral-600">
          {company.category}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-neutral-700">{company.offeringsSummary}</p>

      {company.founders?.length ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase text-neutral-500">Founders</div>
          <div className="mt-1 text-sm text-ink">{company.founders.join(", ")}</div>
        </div>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Stat icon={<CircleDollarSign />} label="Funding" value={company.stats.fundingTotal} />
        <Stat icon={<Users />} label="Employees" value={company.stats.employeeCount} />
        <Stat icon={<Building2 />} label="Revenue" value={company.stats.revenueEstimate} />
        <Stat icon={<Calendar />} label="Founded" value={company.stats.foundedYear?.toString()} />
      </dl>
    </article>
  );
}

function Stat({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
        <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <dd className="mt-1 font-semibold text-ink">{value ?? "Unavailable"}</dd>
    </div>
  );
}
