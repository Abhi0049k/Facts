import { Building2, Calendar, CircleDollarSign, Users } from "lucide-react";
import type { CompanyProfile } from "@/lib/types";

interface CompanyCardProps {
  company: CompanyProfile;
  featured?: boolean;
}

export function CompanyCard({ company, featured = false }: CompanyCardProps) {
  return (
    <article
      className={`rounded-2xl border bg-panel p-6 shadow-panel transition ${
        featured ? "border-2 border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {featured ? (
            <span className="mb-2 inline-block rounded-md bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
              Target
            </span>
          ) : null}
          <h3 className="text-xl font-semibold text-ink leading-none">{company.name}</h3>
          <p className="mt-1 text-sm text-neutral-500">{company.domain}</p>
        </div>
        <span className="rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-medium text-neutral-600">
          {company.category}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-neutral-700">{company.offeringsSummary}</p>

      {company.founders?.length ? (
        <div className="mt-4">
          <div className="text-xs font-medium text-muted">Founders</div>
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
