"use client";
import { NativeChatThread } from "@/components/chat/thread";
import ComponentsCanvas from "@/components/ui/components-canvas";
import { InteractableCanvasDetails } from "@/components/ui/interactable-canvas-details";
import { InteractableTabs } from "@/components/ui/interactable-tabs";
import { ChatProvider } from "@/lib/chat/chat-provider";
import { FileDropZone } from "@/components/data/file-drop-zone";
import { useSyncExternalStore, useState, useCallback } from "react";

const STORAGE_KEY = "tambo-demo-context-key";

function getContextKey(): string {
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function useContextKey(): string | null {
  return useSyncExternalStore(subscribe, getContextKey, () => null);
}

export default function Home() {
  const contextKey = useContextKey();
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; sql: string }>>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // Fetch top queries as suggestions
  const loadSuggestions = useCallback(async () => {
    if (suggestionsLoaded) return;
    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "top" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.queries) {
          setSuggestions(data.queries.slice(0, 6));
        }
      }
    } catch {
      // Silently ignore — suggestions are non-critical
    } finally {
      setSuggestionsLoaded(true);
    }
  }, [suggestionsLoaded]);

  // Load suggestions on mount
  useState(() => {
    loadSuggestions();
  });

  const handleChatDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleChatDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  const handleChatDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    // The FileDropZone inside will handle the actual file processing
  }, []);

  if (!contextKey) {
    return null;
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      onDragOver={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
    >
      <ChatProvider threadId={contextKey} runtime="native">
        <div className="flex h-full overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <NativeChatThread />
            {/* Query suggestion chips */}
            {suggestions.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {suggestions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      // Populate the chat input by dispatching a custom event
                      const event = new CustomEvent("populate-chat-input", {
                        detail: { text: q.sql || q.name },
                      });
                      window.dispatchEvent(event);
                    }}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-700 dark:hover:text-blue-300 transition-colors truncate max-w-[200px]"
                    title={q.sql || q.name}
                  >
                    {q.name}
                  </button>
                ))}
              </div>
            )}
            {/* File drop overlay when dragging files */}
            {isDraggingFile && (
              <div className="px-4 pb-2">
                <FileDropZone
                  className="border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  onUploadComplete={() => setIsDraggingFile(false)}
                  onError={() => setIsDraggingFile(false)}
                />
              </div>
            )}
          </div>
          <div className="hidden md:block w-[60%] overflow-auto">
            <InteractableTabs interactableId="Tabs" />
            <InteractableCanvasDetails interactableId="CanvasDetails" />
            <ComponentsCanvas className="h-full" />
          </div>
        </div>
      </ChatProvider>
    </div>
  );
}
