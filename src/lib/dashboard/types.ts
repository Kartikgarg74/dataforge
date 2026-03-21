export type WidgetType = 'kpi' | 'line' | 'bar' | 'horizontal_bar' | 'stacked_bar' | 'area' | 'pie' | 'donut' | 'scatter' | 'table' | 'text';

export interface Dashboard {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  filters: GlobalFilter[];
  refreshInterval: number;
  isPublic: boolean;
  publicSlug?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardWidget {
  id: string;
  dashboardId: string;
  title: string;
  widgetType: WidgetType;
  queryNatural: string;
  querySQL: string;
  connectorId: string;
  visualization: VisualizationConfig;
  position: WidgetPosition;
  refreshOverride?: number;
  sortOrder: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisualizationConfig {
  chartType: WidgetType;
  xAxis?: string;
  yAxis?: string;
  colorField?: string;
  showLegend?: boolean;
  colors?: string[];
  format?: string;
  comparison?: 'previous_period' | 'same_period_last_year';
  goal?: number;
  prefix?: string;
  suffix?: string;
}

export interface GlobalFilter {
  id: string;
  name: string;
  type: 'date_range' | 'select' | 'multi_select' | 'text';
  column: string;
  table: string;
  defaultValue?: unknown;
  linkedWidgets: string[];
}

export interface SavedQuery {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  category?: string;
  naturalLanguage: string;
  sql: string;
  connectorId: string;
  parameters: QueryParameter[];
  visualization?: VisualizationConfig;
  usageCount: number;
  lastRunAt?: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueryParameter {
  name: string;
  type: 'date' | 'string' | 'number' | 'select';
  label: string;
  defaultValue?: unknown;
  options?: string[];
  required: boolean;
}
