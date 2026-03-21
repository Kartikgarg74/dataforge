"use client";

import type { Canvas, CanvasComponent } from "@/lib/canvas-storage";
import { useCanvasStore } from "@/lib/canvas-storage";
import { useInteractableStore } from "@/lib/interactable-store";
import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";

// Interactable: Tabs-only manager (ids, names, activeCanvasId)

const tabSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const tabsPropsSchema = z.object({
  className: z.string().optional(),
  state: z
    .object({
      canvases: z.array(tabSchema),
      activeCanvasId: z.string().nullable().optional(),
    })
    .optional(),
});

type TabsProps = z.infer<typeof tabsPropsSchema> & {
  onPropsUpdate?: (newProps: Record<string, unknown>) => void;
  interactableId?: string;
};

function TabsWrapper(props: TabsProps) {
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

  // Inbound: reconcile tabs only (ids, names, order, add/remove) and activeCanvasId
  useEffect(() => {
    const inboundState = state ?? storeState;
    const parsed = tabsPropsSchema
      .shape.state
      .safeParse(inboundState);
    if (!parsed.success || !parsed.data) return;

    const inboundKey = JSON.stringify(parsed.data);
    if (inboundKey === lastAppliedKeyRef.current) return;
    lastAppliedKeyRef.current = inboundKey;

    applyingRef.current = true;

    const incomingTabs = parsed.data.canvases || [];
    const incomingActive = parsed.data.activeCanvasId ?? null;

    // Build new canvases array preserving existing components by id
    const { canvases: currentCanvases } = useCanvasStore.getState();
    const idToCanvas = new Map(currentCanvases.map((c) => [c.id, c] as const));

    const nextCanvases = incomingTabs.map((t) => {
      const existing = idToCanvas.get(t.id);
      if (existing) {
        return { ...existing, name: t.name };
      }
      return {
        id: t.id,
        name: t.name,
        components: [] as CanvasComponent[],
      } as Canvas;
    });

    const validActive = nextCanvases.some((c) => c.id === incomingActive)
      ? incomingActive
      : nextCanvases[0]?.id || null;

    useCanvasStore.setState({
      canvases: nextCanvases as Canvas[],
      activeCanvasId: validActive,
    });

    setTimeout(() => {
      applyingRef.current = false;
    }, 0);
  }, [state, storeState]);

  // Helper to build tabs payload
  const buildTabsPayload = () => {
    const s = useCanvasStore.getState();
    return {
      canvases: s.canvases.map((c) => ({ id: c.id, name: c.name })),
      activeCanvasId: s.activeCanvasId,
    };
  };

  // Helper to publish payload
  const publishPayload = useCallback((payload: {
    canvases: { id: string; name: string }[];
    activeCanvasId: string | null;
  }) => {
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

  // Outbound: emit tabs slice (ids, names) and activeCanvasId on store changes
  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe(() => {
      if (applyingRef.current) return;
      const payload = buildTabsPayload();
      publishPayload(payload);
    });
    return () => unsubscribe();
  }, [publishPayload]);

  // Initial publish for late subscribers.
  useEffect(() => {
    const payload = buildTabsPayload();
    publishPayload(payload);
  }, [publishPayload]);

  // No visual UI required; tabs UI remains in page via ComponentsCanvas
  return <div className={className} aria-hidden />;
}

export const InteractableTabs = TabsWrapper;
