import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { toManilaDateString } from "@/lib/units/time";
import { parseReportFilter, REPORT_KEYS, type ReportKey } from "@/features/reports/schemas";
import { runReportAll } from "@/server/services/reports.service";
import { reportToCsv, reportToPdf } from "@/lib/finance/export";

/** Server-authorised exports: GET /api/reports/<report>/<csv|pdf>?from=&to=&… */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/reports/[report]/[format]">,
) {
  const { report, format } = await context.params;
  if (!REPORT_KEYS.includes(report as ReportKey) || !["csv", "pdf"].includes(format)) {
    return NextResponse.json({ error: "Unknown report or format" }, { status: 404 });
  }
  const ctx = await getSessionContext();
  if (!ctx?.business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  try {
    const filter = parseReportFilter(params, toManilaDateString());
    const data = await runReportAll(report as ReportKey, filter);
    const filename = `${report}-${filter.from}-to-${filter.to}`;
    if (format === "csv") {
      return new NextResponse(reportToCsv(data), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const pdf = await reportToPdf(data, ctx.business.businessName);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
