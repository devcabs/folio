import { describe, it, expect } from "vitest";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
  resolveUniqueChartColors,
} from "../../src/utils/chartColors";
import {
  createLinearScale,
  computeSummaryStats,
  computeDataExtent,
  generateCubicBezierPath,
  computeLinearRegression,
} from "../../src/utils/chartMath";
import {
  sanitizeString,
  parsePureNumber,
  extractHeaderUnit,
  parseRangeNotation,
  generatePublicCsv,
} from "../../src/utils/chartSanitizer";
import { BarChart } from "../../src/components/chart/BarChart";
import { LineChart } from "../../src/components/chart/LineChart";
import { DonutChart } from "../../src/components/chart/DonutChart";
import { HistogramChart } from "../../src/components/chart/HistogramChart";
import { ScatterPlot } from "../../src/components/chart/ScatterPlot";
import { ChartRouter } from "../../src/components/chart/ChartRouter";
import { ChartCard } from "../../src/components/chart/ChartCard";
import { DataPendingCard } from "../../src/components/chart/DataPendingCard";
import type { ChartDataset } from "../../src/types/chart";

describe("Vector Chart Studio & D3 Visualizers (Phase 5 Engine Extraction)", () => {
  describe("Sub-Phase 5.1: Chart Color & Math Engines", () => {
    it("resolves unique chart colors without duplicate tokens", () => {
      const colors = resolveUniqueChartColors({ count: 7 });
      expect(colors).toHaveLength(7);
      const unique = new Set(colors);
      expect(unique.size).toBe(7);
    });

    it("anchors supplied accent color at index 0 and avoids duplicate collisions", () => {
      const customAccent = "var(--folio-primary)";
      const colors = resolveUniqueChartColors({
        count: 5,
        accentColor: customAccent,
      });
      expect(colors[0]).toBe(customAccent);
      expect(colors).toHaveLength(5);
    });

    it("scales nicely across small and large counts (>14)", () => {
      const largeColors = resolveUniqueChartColors({ count: 20 });
      expect(largeColors).toHaveLength(20);
      const unique = new Set(largeColors);
      expect(unique.size).toBe(20);
    });

    it("calculates D3 scales, summary statistics, and regressions accurately", () => {
      const extent = computeDataExtent([12, 45, 89, 23]);
      expect(extent[0]).toBe(12);
      expect(extent[1]).toBe(89);

      const scale = createLinearScale([0, 100], [0, 400]);
      expect(scale(50)).toBe(200);

      const stats = computeSummaryStats([10, 20, 30, 40, 50]);
      expect(stats.mean).toBe(30);
      expect(stats.median).toBe(30);
      expect(stats.n).toBe(5);
      expect(stats.stdDev).toBeGreaterThan(0);

      const regression = computeLinearRegression([
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ]);
      expect(regression.slope).toBeCloseTo(2);
      expect(regression.intercept).toBeCloseTo(0);

      const bezier = generateCubicBezierPath([
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 50 },
      ]);
      expect(bezier.startsWith("M ")).toBe(true);
    });

    it("sanitizes raw tabular strings, ranges, and numeric values", () => {
      expect(sanitizeString("  trimmed string  ")).toBe("trimmed string");
      expect(parsePureNumber("₱1,250.50")).toBe(1250.5);
      expect(parsePureNumber("invalid")).toBeNull();
      expect(extractHeaderUnit("Target Revenue (in Millions)")).toBe("in Millions");

      const range = parseRangeNotation("Sheet1!A1:D10");
      expect(range).not.toBeNull();
      expect(range?.startCol).toBe(0);
      expect(range?.startRow).toBe(0);

      const csv = generatePublicCsv(
        ["Q1", "Q2"],
        [{ name: "Revenue", data: [100, 200] }],
        "Test Series",
        "USD"
      );
      expect(csv).toContain("Test Series");
      expect(csv).toContain("Q1");
      expect(csv).toContain("Revenue");
    });
  });

  describe("Sub-Phase 5.2: D3 SVG Visualizer Renderers", () => {
    const mockCategories = ["Phase A", "Phase B", "Phase C"];
    const mockSeries = [
      { name: "Performance", data: [42, 78, 95] },
      { name: "Benchmark", data: [50, 70, 90] },
    ];

    it("renders BarChart SVG with bars, axes, and legends", () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(BarChart, {
          categories: mockCategories,
          series: mockSeries,
          unit: "pts",
        })
      );
      expect(html).toContain("<svg");
      expect(html).toContain("Phase A");
      expect(html).toContain("Performance");
    });

    it("renders LineChart SVG with path interpolation", () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(LineChart, {
          categories: mockCategories,
          series: mockSeries,
          unit: "pts",
          curveInterpolation: "smooth",
        })
      );
      expect(html).toContain("<svg");
      expect(html).toContain("<path");
      expect(html).toContain("Phase A");
    });

    it("renders DonutChart SVG with radial segments", () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(DonutChart, {
          categories: ["Category 1", "Category 2", "Category 3"],
          data: [40, 35, 25],
          unit: "%",
        })
      );
      expect(html).toContain("<svg");
      expect(html).toContain("Category 1");
    });

    it("renders HistogramChart SVG with frequency buckets", () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(HistogramChart, {
          rawValues: [12, 14, 15, 18, 22, 25, 27, 30, 32, 35, 38, 42, 45],
          unit: "units",
        })
      );
      expect(html).toContain("<svg");
      expect(html).toContain("Histogram");
    });

    it("renders ScatterPlot SVG with coordinate data points", () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(ScatterPlot, {
          points: [
            { x: 10, y: 20, label: "P1" },
            { x: 25, y: 55, label: "P2" },
            { x: 40, y: 80, label: "P3" },
          ],
          xLabel: "X Axis",
          yLabel: "Y Axis",
        })
      );
      expect(html).toContain("<svg");
      expect(html).toContain("<circle");
      expect(html).toContain("X Axis");
    });
  });

  describe("Sub-Phase 5.3 & 5.4: Chart Containers & Dynamic Routing", () => {
    it("renders DataPendingCard with parametric mark and customizable headline", () => {
      const html = ReactDOMServer.renderToString(
        React.createElement(DataPendingCard, {
          headline: "Custom Empty Title",
          description: "Custom explanation paragraph.",
        })
      );
      expect(html).toContain("Custom Empty Title");
      expect(html).toContain("Custom explanation paragraph.");
      expect(html).toContain("<svg"); // ParametricShape mark
    });

    it("routes datasets deterministically to corresponding visualizers via ChartRouter", () => {
      const barDataset: ChartDataset = {
        chartId: "chart-1",
        title: "Bar Test",
        chartType: "bar",
        asOfDate: "2026",
        sanitizedCsvContent: "Cat,S1\nCat A,10\nCat B,20",
        categories: ["Cat A", "Cat B"],
        series: [{ name: "S1", data: [10, 20] }],
      };

      const barHtml = ReactDOMServer.renderToString(
        React.createElement(ChartRouter, { dataset: barDataset })
      );
      expect(barHtml).toContain("<svg");
      expect(barHtml).toContain("Cat A");

      const lineDataset: ChartDataset = {
        chartId: "chart-2",
        title: "Line Test",
        chartType: "line",
        asOfDate: "2026",
        sanitizedCsvContent: "Cat,S1\nJan,100\nFeb,200",
        categories: ["Jan", "Feb"],
        series: [{ name: "S1", data: [100, 200] }],
      };

      const lineHtml = ReactDOMServer.renderToString(
        React.createElement(ChartRouter, { dataset: lineDataset })
      );
      expect(lineHtml).toContain("<svg");
      expect(lineHtml).toContain("<path");

      const donutDataset: ChartDataset = {
        chartId: "chart-3",
        title: "Donut Test",
        chartType: "donut",
        asOfDate: "2026",
        sanitizedCsvContent: "Cat,S1\nSlice A,60\nSlice B,40",
        categories: ["Slice A", "Slice B"],
        series: [{ name: "S1", data: [60, 40] }],
      };

      const donutHtml = ReactDOMServer.renderToString(
        React.createElement(ChartRouter, { dataset: donutDataset })
      );
      expect(donutHtml).toContain("<svg");
      expect(donutHtml).toContain("Slice A");
    });

    it("renders ChartCard container with header and action controls", () => {
      const testDataset: ChartDataset = {
        chartId: "chart-card-test",
        title: "Overall Trajectory",
        subtitle: "Key Milestone Progress",
        unit: "%",
        asOfDate: "2026",
        sanitizedCsvContent: "Cat,Velocity\nSprint 1,85\nSprint 2,92",
        chartType: "bar",
        categories: ["Sprint 1", "Sprint 2"],
        series: [{ name: "Velocity", data: [85, 92] }],
      };

      const cardHtml = ReactDOMServer.renderToString(
        React.createElement(ChartCard, {
          chartId: "chart-card-test",
          dataset: testDataset,
          nodeId: "node-1",
        })
      );
      expect(cardHtml).toContain("Overall Trajectory");
      expect(cardHtml).toContain("Key Milestone Progress");
      expect(cardHtml).toContain("<svg");
    });
  });
});
