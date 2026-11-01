"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPHP, toCentavos } from "@/lib/money";
import { formatWeight } from "@/lib/units";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};
const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };

export function MonthlySalesChart({
  data,
}: {
  data: {
    month: string;
    net_sales: number;
    gross_profit: number;
    gross_margin_pct: number | null;
  }[];
}) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-64" data-testid="chart-monthly-sales">
      <ResponsiveContainer>
        <BarChart
          data={data.map((d) => ({ ...d, label: d.month.slice(0, 7) }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={(v: number) => `₱${Math.round(v / 1000)}k`} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => formatPHP(toCentavos(Number(v)))}
          />
          <Bar dataKey="net_sales" name="Net sales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="gross_profit"
            name="Gross profit"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MarginTrendChart({
  data,
}: {
  data: { month: string; gross_margin_pct: number | null }[];
}) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-56" data-testid="chart-margin">
      <ResponsiveContainer>
        <LineChart
          data={data.map((d) => ({ label: d.month.slice(0, 7), margin: d.gross_margin_pct }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
          <Line
            type="monotone"
            dataKey="margin"
            name="Gross margin"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyRoastChart({
  data,
}: {
  data: { week: string; roasted_g: number; green_g: number; loss_pct: number | null }[];
}) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-56" data-testid="chart-weekly-roast">
      <ResponsiveContainer>
        <BarChart
          data={data.map((d) => ({
            label: d.week.slice(5),
            roasted: d.roasted_g,
            green: d.green_g,
            loss: d.loss_pct,
          }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={(v: number) => formatWeight(v)} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => (name === "Loss %" ? `${v}%` : formatWeight(Number(v)))}
          />
          <Bar dataKey="green" name="Green in" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="roasted" name="Roasted out" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function YieldTrendChart({ data }: { data: { week: string; loss_pct: number | null }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-56" data-testid="chart-yield">
      <ResponsiveContainer>
        <LineChart
          data={data.map((d) => ({
            label: d.week.slice(5),
            yieldPct: d.loss_pct !== null ? Math.round((100 - d.loss_pct) * 100) / 100 : null,
          }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} domain={[70, 100]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
          <Line
            type="monotone"
            dataKey="yieldPct"
            name="Yield"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalBars({
  data,
  valueKind,
  testId,
}: {
  data: { label: string; value: number }[];
  valueKind: "money" | "units";
  testId: string;
}) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-56" data-testid={testId}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            {...axis}
            tickFormatter={(v: number) =>
              valueKind === "money" ? `₱${Math.round(v / 1000)}k` : String(v)
            }
          />
          <YAxis type="category" dataKey="label" width={140} {...axis} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) =>
              valueKind === "money" ? formatPHP(toCentavos(Number(v))) : String(v)
            }
          />
          <Bar
            dataKey="value"
            name={valueKind === "money" ? "Net sales" : "Units"}
            fill="var(--chart-5)"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty() {
  return <p className="text-muted-foreground py-8 text-center text-sm">No data in this period.</p>;
}
