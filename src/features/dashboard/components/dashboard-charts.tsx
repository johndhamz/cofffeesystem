"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPHP, toCentavos } from "@/lib/money";
import { formatWeight } from "@/lib/units";
import { cn } from "@/lib/utils";

/* ---------- shared chrome ---------- */

const axis = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "var(--border)" },
};
const grid = { stroke: "var(--border)", strokeDasharray: "2 4", vertical: false };
const barCursor = { fill: "var(--muted)", opacity: 0.6 };
const lineCursor = { stroke: "var(--muted-foreground)", strokeDasharray: "3 3" };

const money = (v: number) => formatPHP(toCentavos(v));
const moneyTick = (v: number) => (Math.abs(v) >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${v}`);
const pct = (v: number) => `${Number(v).toFixed(1)}%`;

type Fmt = (v: number, key: string) => string;

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: {
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string | number;
    payload?: Record<string, unknown>;
  }[];
}

/** Value leads, label follows; each row keyed by a short stroke of its series colour. */
function Tip({
  active,
  label,
  payload,
  fmt,
  title,
}: TipProps & { fmt: Fmt; title?: (p: Record<string, unknown>) => ReactNode }) {
  if (!active || !payload?.length) return null;
  const first = payload[0]?.payload ?? {};
  return (
    <div
      className="bg-popover text-popover-foreground min-w-40 rounded-md border px-3 py-2 text-xs shadow-md"
      role="status"
    >
      <div className="text-muted-foreground mb-1 font-medium">{title ? title(first) : label}</div>
      <ul className="space-y-1">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p) => (
            <li key={String(p.dataKey)} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-0.5 w-3 shrink-0 rounded"
                style={{ background: p.color }}
              />
              <span className="font-semibold tabular-nums">
                {fmt(Number(p.value), String(p.dataKey))}
              </span>
              <span className="text-muted-foreground">{p.name}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Clickable legend: toggles a series on/off (identity never relies on colour alone: the name is always shown). */
function useSeriesToggle(keys: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key);
      else if (n.size < keys.length - 1) n.add(key);
      return n;
    });
  const legend = (
    <Legend
      verticalAlign="top"
      align="left"
      iconType="plainline"
      wrapperStyle={{ paddingBottom: 8, fontSize: 12, cursor: "pointer" }}
      formatter={(value, entry) => {
        const key = String((entry as { dataKey?: string | number }).dataKey ?? value);
        return (
          <span
            className={cn(
              "select-none",
              hidden.has(key) ? "text-muted-foreground line-through" : "text-foreground",
            )}
            data-testid={`legend-${key}`}
          >
            {value}
          </span>
        );
      }}
      onClick={(e) => toggle(String((e as { dataKey?: string | number }).dataKey ?? e.value))}
    />
  );
  return { hidden, legend };
}

function Empty() {
  return <p className="text-muted-foreground py-8 text-center text-sm">No data in this period.</p>;
}

/* ---------- charts ---------- */

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
  const { hidden, legend } = useSeriesToggle(["net_sales", "gross_profit"]);
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-64" data-testid="chart-monthly-sales">
      <ResponsiveContainer>
        <BarChart
          data={data.map((d) => ({ ...d, label: d.month.slice(0, 7) }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="25%"
          barGap={2}
        >
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={moneyTick} width={52} />
          <Tooltip
            cursor={barCursor}
            content={<Tip fmt={(v, k) => (k === "gross_margin_pct" ? pct(v) : money(v))} />}
          />
          {legend}
          <Bar
            dataKey="net_sales"
            name="Net sales"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            hide={hidden.has("net_sales")}
          />
          <Bar
            dataKey="gross_profit"
            name="Gross profit"
            fill="var(--chart-3)"
            radius={[4, 4, 0, 0]}
            hide={hidden.has("gross_profit")}
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
        <ComposedChart
          data={data.map((d) => ({ label: d.month.slice(0, 7), margin: d.gross_margin_pct }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="marginFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={40} />
          <Tooltip cursor={lineCursor} content={<Tip fmt={(v) => pct(v)} />} />
          <Area
            type="monotone"
            dataKey="margin"
            name="Gross margin"
            stroke="none"
            fill="url(#marginFill)"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="margin"
            name="Gross margin"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }}
            activeDot={{ r: 6 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyRoastChart({
  data,
}: {
  data: { week: string; roasted_g: number; green_g: number; loss_pct: number | null }[];
}) {
  const { hidden, legend } = useSeriesToggle(["green", "roasted"]);
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-56" data-testid="chart-weekly-roast">
      <ResponsiveContainer>
        <BarChart
          data={data.map((d) => ({
            label: d.week.slice(5),
            green: d.green_g,
            roasted: d.roasted_g,
            loss: d.loss_pct,
          }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barCategoryGap="25%"
          barGap={2}
        >
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={(v: number) => formatWeight(v)} width={56} />
          <Tooltip
            cursor={barCursor}
            content={
              <Tip
                fmt={(v, k) => (k === "loss" ? pct(v) : formatWeight(v))}
                title={(p) =>
                  `Week of ${String(p.label)}${p.loss !== null && p.loss !== undefined ? ` · loss ${pct(Number(p.loss))}` : ""}`
                }
              />
            }
          />
          {legend}
          <Bar
            dataKey="green"
            name="Green in"
            fill="var(--chart-6)"
            radius={[4, 4, 0, 0]}
            hide={hidden.has("green")}
          />
          <Bar
            dataKey="roasted"
            name="Roasted out"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
            hide={hidden.has("roasted")}
          />
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
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} domain={[70, 100]} tickFormatter={(v: number) => `${v}%`} width={40} />
          <Tooltip
            cursor={lineCursor}
            content={<Tip fmt={(v) => pct(v)} title={(p) => `Week of ${String(p.label)}`} />}
          />
          <Line
            type="monotone"
            dataKey="yieldPct"
            name="Yield"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }}
            activeDot={{ r: 6 }}
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
  color = "var(--chart-1)",
  linkTo,
}: {
  data: { label: string; value: number }[];
  valueKind: "money" | "units";
  testId: string;
  color?: string;
  /** when given, clicking a bar navigates to `base` + the encoded label (product name only when `productName`) */
  linkTo?: { base: string; productName?: boolean };
}) {
  const router = useRouter();
  if (data.length === 0) return <Empty />;
  const fmt = (v: number) => (valueKind === "money" ? money(v) : `${v} units`);
  const rows = data.slice(0, 8);
  return (
    <div style={{ height: Math.max(160, rows.length * 34 + 40) }} data-testid={testId}>
      <ResponsiveContainer>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 72, left: 8, bottom: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid {...grid} vertical horizontal={false} />
          <XAxis
            type="number"
            {...axis}
            tickFormatter={(v: number) => (valueKind === "money" ? moneyTick(v) : String(v))}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            {...axis}
            tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
          />
          <Tooltip cursor={barCursor} content={<Tip fmt={fmt} title={(p) => String(p.label)} />} />
          <Bar
            dataKey="value"
            name={valueKind === "money" ? "Net sales" : "Units"}
            fill={color}
            radius={[0, 4, 4, 0]}
            className={linkTo ? "cursor-pointer" : undefined}
            onClick={(d) => {
              const label = (d as { label?: string }).label;
              if (!linkTo || !label) return;
              const key = linkTo.productName ? label.split(" — ")[0] : label;
              router.push(`${linkTo.base}${encodeURIComponent(key)}`);
            }}
          >
            <LabelList
              dataKey="value"
              position="right"
              offset={6}
              fill="var(--foreground)"
              fontSize={11}
              formatter={(v: unknown) => fmt(Number(v))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
