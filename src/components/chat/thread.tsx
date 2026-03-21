"use client";

import { NativeComponentRenderer } from "@/components/chat/component-renderer";
import { useNativeChat } from "@/lib/chat/use-native-chat";
import { useChatState } from "@/lib/chat/use-chat-state";
import { FormEvent, useState } from "react";

export function NativeChatThread() {
  const { messages, status, lastError } = useChatState();
  const { sendMessage } = useNativeChat();
  const [value, setValue] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = value.trim();
    if (!next || status === "streaming") {
      return;
    }

    setValue("");
    await sendMessage(next);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Ask a question about your data to start the native chat runtime.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-10 rounded-lg bg-primary px-3 py-2 text-primary-foreground"
                  : "mr-10 rounded-lg border border-border bg-card px-3 py-2"
              }
            >
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {message.role}
              </div>
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>

              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.toolCalls.map((call) => (
                    <div
                      key={call.id}
                      className="rounded border border-border bg-muted/40 p-2 text-xs"
                    >
                      <div className="font-medium">Tool: {call.name}</div>
                      {call.error ? (
                        <div className="text-red-600">Error: {call.error}</div>
                      ) : call.output ? (
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(call.output, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-muted-foreground">Running...</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {message.components && message.components.length > 0 && (
                <div className="mt-3 space-y-3">
                  {message.components.map((component, index) => (
                    <NativeComponentRenderer
                      key={`${message.id}-${component.componentType}-${index}`}
                      componentType={component.componentType}
                      props={component.props}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border p-4">
        {lastError && (
          <div className="mb-2 text-sm text-red-600">{lastError}</div>
        )}
        <div className="flex gap-2">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ask about schema, query with sql: SELECT ..., or say neon demo"
            className="min-h-20 w-full resize-y rounded-md border border-border bg-background p-2 text-sm"
          />
          <button
            type="submit"
            disabled={status === "streaming" || value.trim().length === 0}
            className="self-end rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "streaming" ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
