import type { ComparisonResult } from "@/lib/types";

interface ComparisonTableProps {
  comparison: ComparisonResult;
}

export function ComparisonTable({ comparison }: ComparisonTableProps) {
  const companies = [comparison.userCompany, ...comparison.competitors];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-panel">
      <div className="border-b border-line px-6 py-4">
        <h3 className="font-semibold text-ink">Company Comparison Matrix</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Side-by-side comparison of company offerings and identified feature gaps.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-6 py-3.5 font-semibold">Company</th>
              <th className="px-6 py-3.5 font-semibold">Category</th>
              <th className="px-6 py-3.5 font-semibold">Offerings Summary</th>
              <th className="px-6 py-3.5 font-semibold">Gaps Relative to User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {companies.map((company) => {
              const gap = comparison.gaps.find((item) => item.company === company.name);
              const isReference = company.name === comparison.userCompany.name;
              return (
                <tr className="align-top transition hover:bg-paper/40" key={company.name}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-ink">{company.name}</div>
                    {isReference ? (
                      <span className="mt-1 inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                        User Reference
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-neutral-700">{company.category}</td>
                  <td className="max-w-md px-6 py-4 leading-6 text-neutral-700">
                    {company.offeringsSummary}
                  </td>
                  <td className="px-6 py-4 text-neutral-700">
                    {gap?.missingRelativeToUser.length ? (
                      <ul className="list-inside list-disc space-y-1 text-xs text-coral">
                        {gap.missingRelativeToUser.map((missingItem) => (
                          <li key={missingItem}>{missingItem}</li>
                        ))}
                      </ul>
                    ) : isReference ? (
                      <span className="text-xs text-neutral-400">Baseline Target</span>
                    ) : (
                      <span className="text-xs text-neutral-500">No material gaps identified</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
