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
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartPanel title="Funding totals" subtitle="Companies without available funding data are skipped.">
        <BarDataset data={funding as { name: string; value: number }[]} formatter={(value) => `$${value}M`} />
      </ChartPanel>
      <ChartPanel title="Employee count proxy" subtitle="Ranges are charted by midpoint.">
        <BarDataset data={employees as { name: string; value: number }[]} formatter={(value) => `${value}`} />
      </ChartPanel>
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
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-xs text-muted">{subtitle}</p>
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
    return <div className="flex h-full items-center justify-center text-sm text-muted">No chartable data</div>;
  }

  return (
    <ResponsiveContainer height="100%" width="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "var(--font-mono)" }} />
        <YAxis tick={{ fontSize: 12, fontFamily: "var(--font-mono)" }} />
        <Tooltip formatter={(value) => formatter(Number(value))} contentStyle={{ backgroundColor: "var(--ink)", color: "white", border: "none", borderRadius: "12px", boxShadow: "var(--shadow)" }} />
        <Bar dataKey="value" fill="var(--royal)" radius={[4, 4, 0, 0]} />
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