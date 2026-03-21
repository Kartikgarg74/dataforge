/**
 * Visualization Auto-Selection
 *
 * Automatically selects the best chart type based on query result shape.
 */

type WidgetType = 'kpi' | 'line' | 'bar' | 'horizontal_bar' | 'stacked_bar' | 'area' | 'pie' | 'donut' | 'scatter' | 'table';

interface AutoVizResult {
  chartType: WidgetType;
  xAxis?: string;
  yAxis?: string;
  reason: string;
}

function isNumericColumn(values: unknown[]): boolean {
  const sample = values.filter((v) => v !== null && v !== undefined).slice(0, 20);
  if (sample.length === 0) return false;
  return sample.every((v) => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))));
}

function isDateColumn(name: string, values: unknown[]): boolean {
  if (/date|time|created|updated|timestamp/i.test(name)) return true;
  const sample = values.filter((v) => v !== null && v !== undefined).slice(0, 10);
  return sample.length > 0 && sample.every((v) => {
    const d = new Date(String(v));
    return !isNaN(d.getTime());
  });
}

/**
 * Auto-select the best visualization for a query result.
 */
export function autoSelectVisualization(
  rows: Record<string, unknown>[],
  columns: string[]
): AutoVizResult {
  const rowCount = rows.length;
  const colCount = columns.length;

  // No data
  if (rowCount === 0 || colCount === 0) {
    return { chartType: 'table', reason: 'No data to visualize' };
  }

  // Single row, single column → KPI card
  if (rowCount === 1 && colCount === 1) {
    return {
      chartType: 'kpi',
      xAxis: columns[0],
      reason: 'Single value result → KPI card',
    };
  }

  // Single row, multiple columns → KPI (show first value)
  if (rowCount === 1 && colCount <= 5) {
    return {
      chartType: 'kpi',
      xAxis: columns[0],
      reason: 'Single row with few columns → KPI card',
    };
  }

  // Analyze column types
  const colValues = columns.map((col) => rows.map((r) => r[col]));
  const numericCols = columns.filter((_, i) => isNumericColumn(colValues[i]));
  const dateCols = columns.filter((col, i) => isDateColumn(col, colValues[i]));
  const categoryCols = columns.filter((col, i) =>
    !isNumericColumn(colValues[i]) && !isDateColumn(col, colValues[i])
  );

  // Date + numeric → line/area chart (time series)
  if (dateCols.length >= 1 && numericCols.length >= 1) {
    const yAxes = numericCols.slice(0, 3);
    return {
      chartType: yAxes.length > 1 ? 'area' : 'line',
      xAxis: dateCols[0],
      yAxis: yAxes[0],
      reason: `Time series: ${dateCols[0]} × ${yAxes.join(', ')}`,
    };
  }

  // Category + numeric → bar chart
  if (categoryCols.length >= 1 && numericCols.length >= 1) {
    const uniqueCategories = new Set(rows.map((r) => String(r[categoryCols[0]]))).size;

    if (uniqueCategories <= 8) {
      return {
        chartType: numericCols.length > 1 ? 'stacked_bar' : 'bar',
        xAxis: categoryCols[0],
        yAxis: numericCols[0],
        reason: `${uniqueCategories} categories → bar chart`,
      };
    }

    if (uniqueCategories <= 15) {
      return {
        chartType: 'horizontal_bar',
        xAxis: categoryCols[0],
        yAxis: numericCols[0],
        reason: `${uniqueCategories} categories → horizontal bar`,
      };
    }

    // Too many categories → table
    return {
      chartType: 'table',
      reason: `${uniqueCategories} categories → too many for chart, use table`,
    };
  }

  // Two numeric columns → scatter plot
  if (numericCols.length >= 2 && categoryCols.length === 0) {
    return {
      chartType: 'scatter',
      xAxis: numericCols[0],
      yAxis: numericCols[1],
      reason: 'Two numeric columns → scatter plot',
    };
  }

  // Category only with small count → pie/donut
  if (categoryCols.length === 1 && numericCols.length === 1 && rowCount <= 8) {
    return {
      chartType: 'donut',
      xAxis: categoryCols[0],
      yAxis: numericCols[0],
      reason: `${rowCount} items → donut chart`,
    };
  }

  // Default → table
  return {
    chartType: 'table',
    xAxis: columns[0],
    yAxis: columns[1],
    reason: 'Mixed data types → data table',
  };
}
