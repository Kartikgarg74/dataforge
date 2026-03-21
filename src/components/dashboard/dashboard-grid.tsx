'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Pencil,
  X,
  BarChart3,
  PieChart,
  Table,
  Type,
  TrendingUp,
  ScatterChart,
  Activity,
  Grid,
  Gauge,
} from 'lucide-react';
import type { DashboardWidget } from '@/lib/dashboard/types';

interface DashboardGridProps {
  widgets: DashboardWidget[];
  editMode: boolean;
  onLayoutChange?: (widgets: DashboardWidget[]) => void;
  onRemoveWidget?: (id: string) => void;
  onEditWidget?: (id: string) => void;
}

const WIDGET_TYPE_ICONS: Record<string, React.ElementType> = {
  kpi: TrendingUp,
  line: TrendingUp,
  bar: BarChart3,
  horizontal_bar: BarChart3,
  stacked_bar: BarChart3,
  area: Activity,
  pie: PieChart,
  donut: PieChart,
  scatter: ScatterChart,
  table: Table,
  text: Type,
  funnel: BarChart3,
  heatmap: Grid,
  gauge: Gauge,
};

const WIDGET_TYPE_LABELS: Record<string, string> = {
  kpi: 'KPI',
  line: 'Line',
  bar: 'Bar',
  horizontal_bar: 'H-Bar',
  stacked_bar: 'Stacked',
  area: 'Area',
  pie: 'Pie',
  donut: 'Donut',
  scatter: 'Scatter',
  table: 'Table',
  text: 'Text',
  funnel: 'Funnel',
  heatmap: 'Heatmap',
  gauge: 'Gauge',
};

interface SortableWidgetCardProps {
  widget: DashboardWidget;
  editMode: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  children?: React.ReactNode;
}

function SortableWidgetCard({
  widget,
  editMode,
  onEdit,
  onRemove,
}: SortableWidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !editMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `span ${Math.min(widget.position.w, 12)}`,
    gridRow: `span ${widget.position.h}`,
  };

  const Icon = WIDGET_TYPE_ICONS[widget.widgetType] || BarChart3;
  const typeLabel = WIDGET_TYPE_LABELS[widget.widgetType] || widget.widgetType;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-900 rounded-xl border transition-shadow ${
        editMode
          ? 'border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md'
          : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
      } ${isDragging ? 'z-50 shadow-xl' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          {editMode && (
            <button
              {...attributes}
              {...listeners}
              className="p-0.5 cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              aria-label="Drag to reorder"
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {widget.title}
          </h3>
          <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <Icon className="w-2.5 h-2.5" />
            {typeLabel}
          </span>
        </div>
        {editMode && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                aria-label="Edit widget"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500" />
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                aria-label="Remove widget"
              >
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Placeholder body */}
      <div className="flex items-center justify-center p-6">
        <div className="text-center">
          <Icon className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-1" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">
            {typeLabel} widget
          </span>
          {widget.queryNatural && (
            <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] truncate">
              {widget.queryNatural}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardGrid({
  widgets,
  editMode,
  onLayoutChange,
  onRemoveWidget,
  onEditWidget,
}: DashboardGridProps) {
  const [orderedWidgets, setOrderedWidgets] = useState(widgets);

  // Sync when widgets prop changes
  React.useEffect(() => {
    setOrderedWidgets(widgets);
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedWidgets.findIndex((w) => w.id === active.id);
    const newIndex = orderedWidgets.findIndex((w) => w.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedWidgets, oldIndex, newIndex).map(
      (w, i) => ({ ...w, sortOrder: i })
    );

    setOrderedWidgets(reordered);
    onLayoutChange?.(reordered);
  };

  if (orderedWidgets.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          No widgets yet
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {editMode
            ? 'Click "Add Widget" to get started'
            : 'This dashboard has no widgets'}
        </p>
      </div>
    );
  }

  const gridContent = (
    <div
      className={`
        grid gap-4
        grid-cols-1
        sm:grid-cols-1
        md:grid-cols-6
        lg:grid-cols-12
      `}
    >
      <SortableContext
        items={orderedWidgets.map((w) => w.id)}
        strategy={rectSortingStrategy}
      >
        {orderedWidgets.map((widget) => (
          <SortableWidgetCard
            key={widget.id}
            widget={widget}
            editMode={editMode}
            onEdit={
              onEditWidget ? () => onEditWidget(widget.id) : undefined
            }
            onRemove={
              onRemoveWidget ? () => onRemoveWidget(widget.id) : undefined
            }
          />
        ))}
      </SortableContext>
    </div>
  );

  if (!editMode) {
    return gridContent;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {gridContent}
    </DndContext>
  );
}
