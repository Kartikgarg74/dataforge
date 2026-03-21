"use client";

import { getNativeComponentDefinition } from "@/lib/chat/component-registry";

interface NativeComponentRendererProps {
  componentType: string;
  props: Record<string, unknown>;
}

export function NativeComponentRenderer({ componentType, props }: NativeComponentRendererProps) {
  const definition = getNativeComponentDefinition(componentType);

  if (!definition) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        Unknown component type: {componentType}
      </div>
    );
  }

  const parsedProps = definition.propsSchema.safeParse(props);
  if (!parsedProps.success) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        Invalid props for component {componentType}
      </div>
    );
  }

  const Component = definition.component;
  return <Component {...parsedProps.data} />;
}
