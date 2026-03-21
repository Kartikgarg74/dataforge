/**
 * Chart-to-Image Renderer
 *
 * Generates SVG/HTML representations of widgets for use in email reports
 * and Slack delivery. Uses text/SVG fallbacks since Puppeteer/Satori
 * are not installed.
 */

import type { WidgetType, VisualizationConfig } from '@/lib/dashboard/types';

/**
 * Render a single widget to an image buffer (SVG as Buffer).
 * Falls back to text-based SVG since headless browser is not available.
 */
export async function renderChartToImage(
  widgetType: WidgetType,
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig> & { title?: string }
): Promise<Buffer> {
  const svg = renderWidgetToSVG(widgetType, data, config);
  return Buffer.from(svg, 'utf-8');
}

/**
 * Render a widget to an SVG string for embedding in HTML emails.
 */
function renderWidgetToSVG(
  widgetType: WidgetType,
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig> & { title?: string }
): string {
  if (!data || data.length === 0) {
    return emptySVG('No data available');
  }

  switch (widgetType) {
    case 'kpi':
      return renderKPISVG(data, config);
    case 'bar':
    case 'horizontal_bar':
    case 'stacked_bar':
      return renderBarSVG(data, config);
    case 'line':
    case 'area':
      return renderLineSVG(data, config);
    case 'pie':
    case 'donut':
      return renderPieSVG(data, config);
    case 'table':
      return renderTableSVG(data, config);
    case 'scatter':
      return renderScatterSVG(data, config);
    case 'text':
      return renderTextSVG(data);
    default:
      return renderTableSVG(data, config);
  }
}

/**
 * Render a widget to an HTML string suitable for email embedding.
 */
export function renderWidgetToHTML(
  widgetType: WidgetType,
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig> & { title?: string }
): string {
  if (!data || data.length === 0) {
    return '<div style="padding:24px;text-align:center;color:#999;">No data available</div>';
  }

  if (widgetType === 'table') {
    return renderHTMLTable(data);
  }

  if (widgetType === 'kpi') {
    return renderKPIHTML(data, config);
  }

  // For chart types, embed SVG inline
  const svg = renderWidgetToSVG(widgetType, data, config);
  return `<div style="text-align:center;">${svg}</div>`;
}

function emptySVG(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120">
    <rect width="400" height="120" fill="#f9fafb" rx="8"/>
    <text x="200" y="65" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#9ca3af">${escapeXml(message)}</text>
  </svg>`;
}

function renderKPISVG(
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig>
): string {
  const row = data[0];
  const columns = Object.keys(row);
  const rawValue = row[columns[0]];
  const value = formatValue(rawValue, config);
  const label = columns[0];

  // Calculate trend if there's a second row
  let trendText = '';
  let trendColor = '#6b7280';
  if (data.length > 1) {
    const prevValue = Number(data[1]?.[columns[0]]) || 0;
    const currentValue = Number(rawValue) || 0;
    if (prevValue !== 0) {
      const pctChange = ((currentValue - prevValue) / Math.abs(prevValue)) * 100;
      trendText = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%`;
      trendColor = pctChange >= 0 ? '#10b981' : '#ef4444';
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120">
    <rect width="300" height="120" fill="#ffffff" rx="8" stroke="#e5e7eb" stroke-width="1"/>
    <text x="150" y="55" text-anchor="middle" font-family="system-ui,sans-serif" font-size="32" font-weight="bold" fill="#111827">${escapeXml(value)}</text>
    <text x="150" y="80" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#6b7280">${escapeXml(label)}</text>
    ${trendText ? `<text x="150" y="100" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="${trendColor}">${escapeXml(trendText)}</text>` : ''}
  </svg>`;
}

function renderKPIHTML(
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig>
): string {
  const row = data[0];
  const columns = Object.keys(row);
  const rawValue = row[columns[0]];
  const value = formatValue(rawValue, config);
  const label = columns[0];

  let trendHTML = '';
  if (data.length > 1) {
    const prevValue = Number(data[1]?.[columns[0]]) || 0;
    const currentValue = Number(rawValue) || 0;
    if (prevValue !== 0) {
      const pctChange = ((currentValue - prevValue) / Math.abs(prevValue)) * 100;
      const color = pctChange >= 0 ? '#10b981' : '#ef4444';
      const arrow = pctChange >= 0 ? '&#9650;' : '&#9660;';
      trendHTML = `<div style="font-size:14px;color:${color};margin-top:4px;">${arrow} ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%</div>`;
    }
  }

  return `<div style="text-align:center;padding:20px;">
    <div style="font-size:36px;font-weight:700;color:#111827;">${escapeHtml(value)}</div>
    <div style="font-size:13px;color:#6b7280;margin-top:4px;">${escapeHtml(label)}</div>
    ${trendHTML}
  </div>`;
}

function renderBarSVG(
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig>
): string {
  const columns = Object.keys(data[0]);
  const xAxis = config.xAxis || columns[0];
  const yAxis = config.yAxis || columns[1] || columns[0];
  const maxRows = Math.min(data.length, 12);
  const displayData = data.slice(0, maxRows);

  const values = displayData.map((row) => Number(row[yAxis]) || 0);
  const maxValue = Math.max(...values, 1);
  const barWidth = Math.floor(380 / maxRows) - 4;
  const chartHeight = 160;
  const svgWidth = 420;
  const svgHeight = 220;

  const colors = config.colors || ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'];

  let bars = '';
  displayData.forEach((row, i) => {
    const val = Number(row[yAxis]) || 0;
    const barH = (val / maxValue) * chartHeight;
    const x = 20 + i * (barWidth + 4);
    const y = 10 + (chartHeight - barH);
    const color = colors[i % colors.length];
    const label = String(row[xAxis] ?? '').slice(0, 8);

    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="2"/>`;
    bars += `<text x="${x + barWidth / 2}" y="${svgHeight - 15}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#6b7280" transform="rotate(-30 ${x + barWidth / 2} ${svgHeight - 15})">${escapeXml(label)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff" rx="8" stroke="#e5e7eb" stroke-width="1"/>
    ${bars}
  </svg>`;
}

function renderLineSVG(
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig>
): string {
  const columns = Object.keys(data[0]);
  const yAxis = config.yAxis || columns[1] || columns[0];
  const maxRows = Math.min(data.length, 30);
  const displayData = data.slice(0, maxRows);

  const values = displayData.map((row) => Number(row[yAxis]) || 0);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const svgWidth = 420;
  const svgHeight = 200;
  const chartLeft = 20;
  const chartRight = svgWidth - 20;
  const chartTop = 15;
  const chartBottom = svgHeight - 30;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const points = displayData.map((_, i) => {
    const x = chartLeft + (i / (maxRows - 1 || 1)) * chartWidth;
    const y = chartBottom - ((values[i] - minValue) / range) * chartHeight;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');
  const areaPoints = `${chartLeft},${chartBottom} ${polylinePoints} ${chartRight},${chartBottom}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff" rx="8" stroke="#e5e7eb" stroke-width="1"/>
    <polygon points="${areaPoints}" fill="#3b82f6" fill-opacity="0.1"/>
    <polyline points="${polylinePoints}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

function renderPieSVG(
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig>
): string {
  const columns = Object.keys(data[0]);
  const xAxis = config.xAxis || columns[0];
  const yAxis = config.yAxis || columns[1] || columns[0];
  const maxSlices = Math.min(data.length, 8);
  const displayData = data.slice(0, maxSlices);

  const values = displayData.map((row) => Math.abs(Number(row[yAxis]) || 0));
  const total = values.reduce((a, b) => a + b, 0) || 1;

  const colors = config.colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const cx = 120;
  const cy = 100;
  const r = 70;

  let currentAngle = -Math.PI / 2;
  let paths = '';
  let legendItems = '';

  displayData.forEach((row, i) => {
    const fraction = values[i] / total;
    const angle = fraction * 2 * Math.PI;
    const x1 = cx + r * Math.cos(currentAngle);
    const y1 = cy + r * Math.sin(currentAngle);
    const x2 = cx + r * Math.cos(currentAngle + angle);
    const y2 = cy + r * Math.sin(currentAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const color = colors[i % colors.length];
    const label = String(row[xAxis] ?? '').slice(0, 15);

    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}"/>`;
    legendItems += `<text x="260" y="${30 + i * 18}" font-family="system-ui,sans-serif" font-size="10" fill="#374151"><tspan fill="${color}">&#9632;</tspan> ${escapeXml(label)} (${(fraction * 100).toFixed(0)}%)</text>`;

    currentAngle += angle;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200" viewBox="0 0 420 200">
    <rect width="420" height="200" fill="#ffffff" rx="8" stroke="#e5e7eb" stroke-width="1"/>
    ${paths}
    ${legendItems}
  </svg>`;
}

function renderScatterSVG(
  data: Record<string, unknown>[],
  config: Partial<VisualizationConfig>
): string {
  const columns = Object.keys(data[0]);
  const xAxis = config.xAxis || columns[0];
  const yAxis = config.yAxis || columns[1] || columns[0];
  const maxPoints = Math.min(data.length, 50);
  const displayData = data.slice(0, maxPoints);

  const xValues = displayData.map((row) => Number(row[xAxis]) || 0);
  const yValues = displayData.map((row) => Number(row[yAxis]) || 0);

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const svgWidth = 420;
  const svgHeight = 200;
  const pad = 25;

  let dots = '';
  displayData.forEach((_, i) => {
    const x = pad + ((xValues[i] - xMin) / xRange) * (svgWidth - 2 * pad);
    const y = (svgHeight - pad) - ((yValues[i] - yMin) / yRange) * (svgHeight - 2 * pad);
    dots += `<circle cx="${x}" cy="${y}" r="3" fill="#3b82f6" fill-opacity="0.7"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff" rx="8" stroke="#e5e7eb" stroke-width="1"/>
    ${dots}
  </svg>`;
}

function renderTableSVG(
  data: Record<string, unknown>[],
  _config: Partial<VisualizationConfig>
): string {
  // For tables, we return an HTML table instead of SVG since it's more readable in emails
  return renderHTMLTable(data);
}

function renderTextSVG(data: Record<string, unknown>[]): string {
  const columns = Object.keys(data[0]);
  const text = String(data[0]?.[columns[0]] ?? '').slice(0, 200);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80" viewBox="0 0 400 80">
    <rect width="400" height="80" fill="#ffffff" rx="8" stroke="#e5e7eb" stroke-width="1"/>
    <text x="20" y="45" font-family="system-ui,sans-serif" font-size="13" fill="#374151">${escapeXml(text)}</text>
  </svg>`;
}

function renderHTMLTable(data: Record<string, unknown>[]): string {
  const columns = Object.keys(data[0]);
  const maxRows = Math.min(data.length, 25);
  const displayData = data.slice(0, maxRows);

  const headerCells = columns
    .map(
      (col) =>
        `<th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:2px solid #e5e7eb;white-space:nowrap;">${escapeHtml(col)}</th>`
    )
    .join('');

  const rows = displayData
    .map(
      (row, idx) =>
        `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">${columns
          .map(
            (col) =>
              `<td style="padding:6px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${escapeHtml(String(row[col] ?? ''))}</td>`
          )
          .join('')}</tr>`
    )
    .join('');

  let footer = '';
  if (data.length > maxRows) {
    footer = `<tr><td colspan="${columns.length}" style="padding:8px 12px;font-size:11px;color:#9ca3af;text-align:center;">Showing ${maxRows} of ${data.length} rows</td></tr>`;
  }

  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${rows}${footer}</tbody>
  </table>`;
}

/**
 * Render a complete dashboard with all widget results to a full HTML document.
 * Used for email report bodies.
 */
export function renderDashboardToHTML(
  dashboard: { name: string; description?: string; widgets: Array<{ id: string; title: string; widgetType: WidgetType; visualization: Partial<VisualizationConfig> }> },
  widgetResults: Map<string, { data: Record<string, unknown>[]; columns: string[] }>
): string {
  const sections = dashboard.widgets.map((widget) => {
    const result = widgetResults.get(widget.id);
    const data = result?.data || [];
    const htmlContent = renderWidgetToHTML(widget.widgetType, data, widget.visualization);

    return `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:14px;font-weight:600;color:#374151;margin:0 0 8px 0;">${escapeHtml(widget.title)}</h3>
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          ${htmlContent}
        </div>
      </div>
    `;
  });

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(dashboard.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="padding:24px;border-bottom:1px solid #e5e7eb;">
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 4px 0;">${escapeHtml(dashboard.name)}</h1>
        ${dashboard.description ? `<p style="font-size:13px;color:#6b7280;margin:0 0 4px 0;">${escapeHtml(dashboard.description)}</p>` : ''}
        <p style="font-size:12px;color:#9ca3af;margin:0;">${dateStr}</p>
      </div>
      <div style="padding:24px;">
        ${sections.join('')}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// --- Utility helpers ---

function formatValue(
  raw: unknown,
  config: Partial<VisualizationConfig>
): string {
  const num = Number(raw);
  const prefix = config.prefix || '';
  const suffix = config.suffix || '';

  if (isNaN(num)) {
    return `${prefix}${String(raw ?? '')}${suffix}`;
  }

  switch (config.format) {
    case 'currency':
      return `${prefix || '$'}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
    case 'percent':
      return `${prefix}${(num * 100).toFixed(1)}%${suffix}`;
    default:
      return `${prefix}${num.toLocaleString('en-US')}${suffix}`;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
