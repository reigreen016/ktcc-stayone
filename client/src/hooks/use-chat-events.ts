import { useEffect, useRef } from "react";
import type { ChatEvent } from "@/types/chat";
import { useAuth } from "@/context/auth-context";

export function useChatEvents(handler: (event: ChatEvent) => void) {
  const { token } = useAuth();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!token || typeof window === "undefined") {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/ws/chat?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);

    const onMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as ChatEvent;
        handlerRef.current?.(payload);
      } catch (error) {
        console.error("Failed to parse chat event", error);
      }
    };

    socket.addEventListener("message", onMessage);

    return () => {
      socket.removeEventListener("message", onMessage);
      socket.close();
    };
  }, [token]);
}
