"use client";

import { useCanvasStore } from "@/lib/canvas-storage";
import { useInteractableStore } from "@/lib/interactable-store";
import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";

// Interactable that exposes/edit charts of the active canvas only

const chartSchema = z.object({
  id: z.string().describe("Canvas component id (Graph only)"),
  title: z.string().describe("Chart title"),
  type: z.enum(["bar", "line", "pie"]).describe("Chart type"),
});

const canvasDetailsPropsSchema = z.object({
  className: z.string().optional(),
  state: z
    .object({
      charts: z
        .array(chartSchema)
        .describe(
          "Active canvas charts in desired order (Graph components only)",
        ),
    })
    .optional(),
});

type CanvasDetailsProps = z.infer<typeof canvasDetailsPropsSchema> & {
  onPropsUpdate?: (newProps: Record<string, unknown>) => void;
  interactableId?: string;
};

function CanvasDetailsWrapper(props: CanvasDetailsProps) {
  const { className, state, onPropsUpdate, interactableId } = props;
  const storeState = useInteractableStore((s) =>
    interactableId ? s.propsById[interactableId]?.state : undefined,
  );
  const setInteractableProps = useInteractableStore(
    (s) => s.setInteractableProps,
  );

  const applyingRef = useRef(false);
  const lastEmittedKeyRef = useRef("");
  const lastAppliedKeyRef = useRef("");

  // Inbound: apply edits to active canvas
  useEffect(() => {
    const inboundState = state ?? storeState;
    const parsed = canvasDetailsPropsSchema
      .shape.state
      .safeParse(inboundState);
    if (!parsed.success || !parsed.data) return;

    const inboundKey = JSON.stringify(parsed.data);
    if (inboundKey === lastAppliedKeyRef.current) return;
    lastAppliedKeyRef.current = inboundKey;

    applyingRef.current = true;
    const s = useCanvasStore.getState();
    const activeId = s.activeCanvasId;
    if (!activeId) {
      applyingRef.current = false;
      return;
    }
    const shards = parsed.data.charts ?? [];

    // Reorder based on provided order and update title/type
    // Build a map for quick lookup
    const idToIndex: Record<string, number> = {};
    shards.forEach((c, idx) => (idToIndex[c.id] = idx));

    // Apply updates
    shards.forEach((c) => {
      const current = useCanvasStore
        .getState()
        .getComponents(activeId)
        .find((x) => x.componentId === c.id) as
        | (Record<string, unknown> & { data?: Record<string, unknown> })
        | undefined;

      useCanvasStore.getState().updateComponent(activeId, c.id, {
        title: c.title,
        data: {
          ...(typeof current?.data === "object" && current?.data
            ? (current.data as Record<string, unknown>)
            : {}),
          type: c.type,
          // Keep title in data as well for backward compatibility
          title: c.title,
        },
      });
    });

    // Reorder according to charts order using store helper for stability
    shards.forEach((c, targetIndex) => {
      useCanvasStore.getState().reorderComponent(activeId, c.id, targetIndex);
    });

    setTimeout(() => {
      applyingRef.current = false;
    }, 0);
  }, [state, storeState]);

  // Helper to build charts payload
  const buildChartsPayload = () => {
    const s = useCanvasStore.getState();
    const active = s.activeCanvasId
      ? s.canvases.find((c) => c.id === s.activeCanvasId)
      : undefined;
    const charts = (active?.components || [])
      .filter((c) => c._componentType === "Graph")
      .map((c) => ({
        id: c.componentId,
        title:
          (c as { title?: string }).title ??
          (c as { data?: { title?: string } }).data?.title ??
          "",
        type: ((c as { data?: { type?: string } }).data?.type ?? "bar") as
          | "bar"
          | "line"
          | "pie",
      }));
    return { charts };
  };

  // Helper to publish payload
  const publishPayload = useCallback((payload: { charts: { id: string; title: string; type: "bar" | "line" | "pie" }[] }) => {
    const key = JSON.stringify(payload);
    if (key === lastEmittedKeyRef.current) return;
    lastEmittedKeyRef.current = key;
    onPropsUpdate?.({ state: payload, className });
    if (interactableId) {
      setInteractableProps(interactableId, {
        state: payload,
        className,
      });
    }
  }, [onPropsUpdate, className, interactableId, setInteractableProps]);

  // Outbound: publish simplified charts snapshot for active canvas on store changes
  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe(() => {
      if (applyingRef.current) return;
      const payload = buildChartsPayload();
      publishPayload(payload);
    });
    return () => unsubscribe();
  }, [publishPayload]);

  // Initial publish for late subscribers.
  useEffect(() => {
    const payload = buildChartsPayload();
    publishPayload(payload);
  }, [publishPayload]);

  // Minimal UI (hidden content is fine; needs to be rendered for MCP)
  return (
    <div className={className} aria-hidden>
      {/* CanvasDetails interactable (no visible UI) */}
    </div>
  );
}

export const InteractableCanvasDetails = CanvasDetailsWrapper;
