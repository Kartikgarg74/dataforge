import { create } from "zustand";

export type InteractableProps = {
  className?: string;
  state?: unknown;
};

type InteractableStore = {
  propsById: Record<string, InteractableProps>;
  setInteractableProps: (id: string, props: InteractableProps) => void;
  clearInteractableProps: (id: string) => void;
};

export const useInteractableStore = create<InteractableStore>((set) => ({
  propsById: {},
  setInteractableProps: (id, props) =>
    set((current) => ({
      propsById: {
        ...current.propsById,
        [id]: {
          ...(current.propsById[id] || {}),
          ...props,
        },
      },
    })),
  clearInteractableProps: (id) =>
    set((current) => {
      const next = { ...current.propsById };
      delete next[id];
      return { propsById: next };
    }),
}));
