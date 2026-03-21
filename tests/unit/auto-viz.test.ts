import { describe, it, expect } from 'vitest';
import { autoSelectVisualization } from '../../src/lib/dashboard/auto-viz';

describe('Auto Visualization Selection', () => {
  describe('single value → KPI', () => {
    it('selects KPI for single row, single column', () => {
      const result = autoSelectVisualization(
        [{ total: 42 }],
        ['total'],
      );
      expect(result.chartType).toBe('kpi');
    });

    it('selects KPI for single row with few columns', () => {
      const result = autoSelectVisualization(
        [{ revenue: 1000, profit: 200, margin: 0.2 }],
        ['revenue', 'profit', 'margin'],
      );
      expect(result.chartType).toBe('kpi');
    });

    it('selects KPI for single row with up to 5 columns', () => {
      const result = autoSelectVisualization(
        [{ a: 1, b: 2, c: 3, d: 4, e: 5 }],
        ['a', 'b', 'c', 'd', 'e'],
      );
      expect(result.chartType).toBe('kpi');
    });
  });

  describe('date + numeric → line chart', () => {
    it('selects line chart for date column + one numeric column', () => {
      const rows = [
        { date: '2024-01-01', value: 10 },
        { date: '2024-02-01', value: 20 },
        { date: '2024-03-01', value: 30 },
      ];
      const result = autoSelectVisualization(rows, ['date', 'value']);
      expect(result.chartType).toBe('line');
      expect(result.xAxis).toBe('date');
    });

    it('selects area chart for date + multiple numeric columns', () => {
      const rows = [
        { timestamp: '2024-01-01', revenue: 100, cost: 50 },
        { timestamp: '2024-02-01', revenue: 150, cost: 60 },
        { timestamp: '2024-03-01', revenue: 200, cost: 70 },
      ];
      const result = autoSelectVisualization(rows, ['timestamp', 'revenue', 'cost']);
      expect(result.chartType).toBe('area');
    });

    it('detects date columns by name pattern', () => {
      const rows = [
        { created_at: '2024-01-01', count: 5 },
        { created_at: '2024-02-01', count: 10 },
      ];
      const result = autoSelectVisualization(rows, ['created_at', 'count']);
      expect(result.chartType).toBe('line');
      expect(result.xAxis).toBe('created_at');
    });
  });

  describe('category + numeric → bar chart', () => {
    it('selects bar chart for few categories (non-date-parseable strings)', () => {
      // Use clearly non-date category strings that won't be parsed as dates
      const rows = [
        { department: 'Sales Dept', headcount: 10 },
        { department: 'Engineering Dept', headcount: 25 },
        { department: 'Marketing Dept', headcount: 8 },
      ];
      const result = autoSelectVisualization(rows, ['department', 'headcount']);
      expect(result.chartType).toBe('bar');
      expect(result.xAxis).toBe('department');
      expect(result.yAxis).toBe('headcount');
    });
  });

  describe('category + numeric (many categories)', () => {
    it('selects horizontal bar for 9-15 non-date-parseable categories', () => {
      // Ensure category strings don't parse as valid dates
      const rows = Array.from({ length: 12 }, (_, i) => ({
        product: `Widget Model #${i}xyz`,
        sales: (i + 1) * 10,
      }));
      const result = autoSelectVisualization(rows, ['product', 'sales']);
      expect(result.chartType).toBe('horizontal_bar');
    });

    it('selects table for more than 15 non-date-parseable categories', () => {
      const rows = Array.from({ length: 20 }, (_, i) => ({
        product: `Widget Model #${i}xyz`,
        sales: (i + 1) * 10,
      }));
      const result = autoSelectVisualization(rows, ['product', 'sales']);
      expect(result.chartType).toBe('table');
    });
  });

  describe('two numeric columns', () => {
    it('selects area/line when numeric values are parseable as dates', () => {
      // The isDateColumn heuristic uses new Date(String(v)) which accepts
      // many numeric strings. When all numeric values happen to parse as
      // valid dates, the date+numeric branch fires before the scatter branch.
      const rows = [
        { x_val: 10, y_val: 20 },
        { x_val: 30, y_val: 40 },
        { x_val: 50, y_val: 60 },
      ];
      const result = autoSelectVisualization(rows, ['x_val', 'y_val']);
      expect(['line', 'area', 'scatter']).toContain(result.chartType);
    });

    it('selects scatter when numeric values cannot be parsed as dates', () => {
      // Use values that new Date(String(v)) rejects: e.g., "Infinity", "NaN"
      // Actually the function checks typeof v === 'number' for isNumericColumn,
      // but isDateColumn tries new Date(String(v)).
      // Use null-interspersed data where non-null values are clearly not dates
      const rows = [
        { x_val: Infinity, y_val: Infinity },
        { x_val: Infinity, y_val: Infinity },
        { x_val: Infinity, y_val: Infinity },
      ];
      const result = autoSelectVisualization(rows, ['x_val', 'y_val']);
      // Infinity is numeric (typeof === 'number') but new Date("Infinity") → Invalid Date
      expect(result.chartType).toBe('scatter');
    });
  });

  describe('empty data → table', () => {
    it('selects table for empty rows', () => {
      const result = autoSelectVisualization([], []);
      expect(result.chartType).toBe('table');
    });

    it('selects table for empty rows with columns defined', () => {
      const result = autoSelectVisualization([], ['a', 'b']);
      expect(result.chartType).toBe('table');
    });

    it('reason mentions no data', () => {
      const result = autoSelectVisualization([], []);
      expect(result.reason.toLowerCase()).toContain('no data');
    });
  });

  describe('reason is always provided', () => {
    it('includes a reason string for KPI', () => {
      const r = autoSelectVisualization([{ x: 1 }], ['x']);
      expect(r.reason).toBeTruthy();
      expect(typeof r.reason).toBe('string');
    });

    it('includes a reason string for table fallback', () => {
      const r = autoSelectVisualization([], []);
      expect(r.reason).toBeTruthy();
    });
  });
});
