import type { ElementType } from "react";
import type { ZodTypeAny } from "zod";

import { ConnectCard, connectCardSchema } from "@/components/tambo/connect-card";
import { ERDiagram, erDiagramSchema } from "@/components/tambo/er-diagram";
import { ExportPanel, exportPanelSchema } from "@/components/tambo/export-panel";
import { Graph, graphSchema } from "@/components/tambo/graph";
import { NeonDemo, neonDemoSchema } from "@/components/tambo/neon-demo";
import { PythonTransform, pythonTransformSchema } from "@/components/tambo/python-transform";
import {
  SchemaVisualizer,
  schemaVisualizerSchema,
} from "@/components/tambo/schema-visualizer";
import { SmartChart, smartChartSchema } from "@/components/tambo/smart-chart";

export interface NativeComponentDefinition {
  name: string;
  description: string;
  component: ElementType;
  propsSchema: ZodTypeAny;
}

export const nativeComponentRegistry: Record<string, NativeComponentDefinition> = {
  Graph: {
    name: "Graph",
    description: "Display data as a chart",
    component: Graph,
    propsSchema: graphSchema,
  },
  SmartChart: {
    name: "SmartChart",
    description: "Chart component for SQL results",
    component: SmartChart,
    propsSchema: smartChartSchema,
  },
  ExportPanel: {
    name: "ExportPanel",
    description: "Export data as CSV or JSON",
    component: ExportPanel,
    propsSchema: exportPanelSchema,
  },
  PythonTransform: {
    name: "PythonTransform",
    description: "Python transformation display",
    component: PythonTransform,
    propsSchema: pythonTransformSchema,
  },
  SchemaVisualizer: {
    name: "SchemaVisualizer",
    description: "Database schema list view",
    component: SchemaVisualizer,
    propsSchema: schemaVisualizerSchema,
  },
  ERDiagram: {
    name: "ERDiagram",
    description: "Interactive ER diagram",
    component: ERDiagram,
    propsSchema: erDiagramSchema,
  },
  NeonDemo: {
    name: "NeonDemo",
    description: "Neon database browser demo component",
    component: NeonDemo,
    propsSchema: neonDemoSchema,
  },
  ConnectCard: {
    name: "ConnectCard",
    description: "Service connection status card",
    component: ConnectCard,
    propsSchema: connectCardSchema,
  },
};

export function getNativeComponentDefinition(name: string): NativeComponentDefinition | null {
  return nativeComponentRegistry[name] || null;
}

export function getNativeComponentNames(): string[] {
  return Object.keys(nativeComponentRegistry);
}
