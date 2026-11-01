import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { WeightDisplay } from "@/components/shared/weight-display";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";

describe("shared display components", () => {
  it("renders PHP currency from database decimals", () => {
    render(<CurrencyDisplay value={4500} />);
    expect(screen.getByTestId("currency").textContent).toMatch(/₱\s?4,500\.00/);
  });

  it("renders a dash for missing values", () => {
    render(<CurrencyDisplay value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders weights in kg when large and signed when asked", () => {
    const { rerender } = render(<WeightDisplay grams={10000} />);
    expect(screen.getByTestId("weight").textContent).toBe("10 kg");
    rerender(<WeightDisplay grams={-250} signed />);
    expect(screen.getByTestId("weight").textContent).toBe("−250 g");
  });

  it("labels statuses", () => {
    render(<StatusBadge status="partially_received" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Partially received");
  });

  it("renders empty states and metric cards", () => {
    render(<EmptyState title="Nothing" description="desc" />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("Nothing");
    render(<MetricCard label="Lots" value={3} testId="m" />);
    expect(screen.getByTestId("m-value")).toHaveTextContent("3");
  });
});
