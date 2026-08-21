import type { ComparisonResult } from "@/lib/types";

interface ComparisonTableProps {
  comparison: ComparisonResult;
}

export function ComparisonTable({ comparison }: ComparisonTableProps) {
  const companies = [comparison.userCompany, ...comparison.competitors];

  return (
    <div className="overflow-hidden rounded-md border border-line bg-panel shadow-panel">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-semibold text-ink">Company comparison</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Offerings</th>
              <th className="px-4 py-3 font-semibold">Gaps relative to user</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => {
              const gap = comparison.gaps.find((item) => item.company === company.name);
              return (
                <tr className="border-t border-line align-top" key={company.name}>
                  <td className="px-4 py-3 font-semibold text-ink">{company.name}</td>
                  <td className="px-4 py-3 text-neutral-700">{company.category}</td>
                  <td className="max-w-xl px-4 py-3 leading-6 text-neutral-700">
                    {company.offeringsSummary}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {gap?.missingRelativeToUser.length
                      ? gap.missingRelativeToUser.join(", ")
                      : company.name === comparison.userCompany.name
                        ? "Reference company"
                        : "No material gaps identified"}
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
