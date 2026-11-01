"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDuration, rateOfRise } from "@/lib/roasting/calculations";
import type { Tables } from "@/types";

/** BT / ET / RoR curve from manual or imported measurements. */
export function RoastChart({ measurements }: { measurements: Tables<"roast_measurements">[] }) {
  const sorted = [...measurements].sort((a, b) => a.elapsed_seconds - b.elapsed_seconds);
  if (sorted.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Add at least two measurements to draw the roast curve.
      </p>
    );
  }
  const data = sorted.map((m, i) => {
    const prev = sorted[i - 1];
    const ror =
      m.bt_c !== null && prev && prev.bt_c !== null
        ? rateOfRise(
            { elapsedSeconds: prev.elapsed_seconds, btC: prev.bt_c },
            { elapsedSeconds: m.elapsed_seconds, btC: m.bt_c },
          )
        : null;
    return { t: m.elapsed_seconds, BT: m.bt_c, ET: m.et_c, RoR: ror };
  });
  return (
    <div className="h-72 w-full" data-testid="roast-chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="t"
            tickFormatter={(v: number) => formatDuration(v)}
            stroke="var(--muted-foreground)"
            fontSize={12}
          />
          <YAxis
            yAxisId="temp"
            stroke="var(--muted-foreground)"
            fontSize={12}
            domain={["auto", "auto"]}
          />
          <YAxis
            yAxisId="ror"
            orientation="right"
            stroke="var(--muted-foreground)"
            fontSize={12}
            domain={[0, "auto"]}
          />
          <Tooltip
            labelFormatter={(v) => `t = ${formatDuration(Number(v))}`}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="BT"
            stroke="var(--chart-1)"
            dot={false}
            strokeWidth={2}
            connectNulls
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="ET"
            stroke="var(--chart-2)"
            dot={false}
            strokeWidth={2}
            connectNulls
          />
          <Line
            yAxisId="ror"
            type="monotone"
            dataKey="RoR"
            stroke="var(--chart-3)"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
