import { useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    PluggyConnect?: new (config: PluggyConnectConfig) => PluggyConnectInstance;
  }
}

interface PluggyConnectConfig {
  connectToken: string;
  includeSandbox?: boolean;
  onSuccess: (data: PluggySuccessData) => void;
  onError: (error: PluggyError) => void;
  onClose?: () => void;
  onEvent?: (event: PluggyEvent) => void;
}

interface PluggyConnectInstance {
  init: () => Promise<void>;
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

interface PluggySuccessData {
  item: {
    id: string;
  };
}

interface PluggyError {
  message: string;
  code?: string;
}

interface PluggyEvent {
  event: string;
  data?: unknown;
}

interface PluggyWidgetProps {
  connectToken: string;
  onSuccess: (itemId: string) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

const PLUGGY_SCRIPT_URL = "https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js";

export function PluggyWidget({ connectToken, onSuccess, onError, onClose }: PluggyWidgetProps) {
  const instanceRef = useRef<PluggyConnectInstance | null>(null);
  const initializingRef = useRef(false);

  const initWidget = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    if (!window.PluggyConnect) {
      console.error("[PluggyWidget] PluggyConnect not loaded");
      onError("Widget não carregado");
      initializingRef.current = false;
      return;
    }

    console.log("[PluggyWidget] Initializing with token:", connectToken.substring(0, 20) + "...");

    try {
      // Create instance with new PluggyConnect()
      const pluggyConnect = new window.PluggyConnect({
        connectToken,
        includeSandbox: true, // Enable sandbox for testing
        onSuccess: (data) => {
          console.log("[PluggyWidget] Success:", data);
          onSuccess(data.item.id);
        },
        onError: (error) => {
          console.error("[PluggyWidget] Error:", error);
          onError(error.message);
        },
        onClose: () => {
          console.log("[PluggyWidget] Closed");
          onClose?.();
        },
        onEvent: (event) => {
          console.log("[PluggyWidget] Event:", event);
        },
      });

      instanceRef.current = pluggyConnect;

      // Open widget with init()
      await pluggyConnect.init();
      console.log("[PluggyWidget] Widget opened");
    } catch (err) {
      console.error("[PluggyWidget] Init error:", err);
      onError(err instanceof Error ? err.message : "Erro ao abrir widget");
    } finally {
      initializingRef.current = false;
    }
  }, [connectToken, onSuccess, onError, onClose]);

  useEffect(() => {
    // Check if script already loaded
    if (window.PluggyConnect) {
      initWidget();
      return;
    }

    // Check if script is being loaded
    const existingScript = document.querySelector(`script[src="${PLUGGY_SCRIPT_URL}"]`);
    if (existingScript) {
      const handleLoad = () => initWidget();
      existingScript.addEventListener("load", handleLoad);
      return () => existingScript.removeEventListener("load", handleLoad);
    }

    // Load script
    const script = document.createElement("script");
    script.src = PLUGGY_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      console.log("[PluggyWidget] Script loaded");
      initWidget();
    };
    script.onerror = () => {
      console.error("[PluggyWidget] Failed to load script");
      onError("Falha ao carregar widget");
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn("[PluggyWidget] Cleanup error:", e);
        }
      }
    };
  }, [connectToken, initWidget, onError]);

  // This component doesn't render anything visible
  // The Pluggy widget is a modal overlay
  return null;
}
