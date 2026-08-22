"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { CompanyProfile, ComparisonResult } from "@/lib/types";

interface ComparisonChartProps {
  comparison: ComparisonResult;
}

export function ComparisonChart({ comparison }: ComparisonChartProps) {
  const companies = [comparison.userCompany, ...comparison.competitors];
  const funding = companies
    .map((company) => ({
      name: company.name,
      value: parseMoney(company.stats.fundingTotal)
    }))
    .filter((row) => row.value !== null);

  const employees = companies
    .map((company) => ({
      name: company.name,
      value: parseEmployeeCount(company.stats.employeeCount)
    }))
    .filter((row) => row.value !== null);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="Funding totals" subtitle="Companies without available funding data are skipped.">
        <BarDataset data={funding as { name: string; value: number }[]} formatter={(value) => `$${value}M`} />
      </ChartPanel>
      <ChartPanel title="Employee count proxy" subtitle="Ranges are charted by midpoint.">
        <BarDataset data={employees as { name: string; value: number }[]} formatter={(value) => `${value}`} />
      </ChartPanel>
    </div>
  );
}

export function ServicesMatrix({ comparison }: ComparisonChartProps) {
  const companies = [comparison.userCompany, ...comparison.competitors];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-panel">
      <div className="border-b border-line px-6 py-4">
        <h3 className="font-semibold text-ink">Services Overlap Matrix</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Feature-by-feature capability match across target and competitor organizations.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-6 py-3.5 font-semibold">Service / Feature</th>
              {companies.map((company) => (
                <th className="px-6 py-3.5 font-semibold" key={company.name}>
                  {company.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {comparison.serviceOverlap.map((row) => (
              <tr className="transition hover:bg-paper/40" key={row.service}>
                <td className="px-6 py-3.5 font-medium text-ink">{row.service}</td>
                {companies.map((company) => {
                  const hasService = row.companies.includes(company.name);
                  return (
                    <td className="px-6 py-3.5" key={company.name}>
                      <span
                        className={`inline-flex h-6 min-w-12 items-center justify-center rounded-md px-2 text-xs font-semibold ${
                          hasService
                            ? "bg-accent text-white"
                            : "border border-line bg-paper text-neutral-400"
                        }`}
                      >
                        {hasService ? "Yes" : "No"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-6 shadow-panel">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

function BarDataset({
  data,
  formatter
}: {
  data: { name: string; value: number }[];
  formatter: (value: number) => string;
}) {
  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-500">No chartable data</div>;
  }

  return (
    <ResponsiveContainer height="100%" width="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="#dce2d7" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => formatter(Number(value))} />
        <Bar dataKey="value" fill="#236b5b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function parseMoney(value?: string): number | null {
  if (!value) {
    return null;
  }
  const match = value.match(/([\d.]+)/);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  if (value.toLowerCase().includes("b")) {
    return amount * 1000;
  }
  return amount;
}

function parseEmployeeCount(value?: string): number | null {
  if (!value) {
    return null;
  }
  const range = value.match(/(\d+)[^\d]+(\d+)/);
  if (range) {
    return Math.round((Number(range[1]) + Number(range[2])) / 2);
  }
  const single = value.match(/\d+/);
  return single ? Number(single[0]) : null;
}
