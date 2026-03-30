"use client";

import { useEffect, useState, type ReactNode } from "react";

type AuthoringBootstrapEntryProps<BootstrapRequest, BootstrapData> = {
  bootstrapRequest: BootstrapRequest;
  loadBootstrap: (request: BootstrapRequest) => Promise<BootstrapData>;
  preloadModule?: () => Promise<unknown>;
  loadingState: ReactNode;
  children: (bootstrapData: BootstrapData) => ReactNode;
};

export function AuthoringBootstrapEntry<BootstrapRequest, BootstrapData>({
  bootstrapRequest,
  loadBootstrap,
  preloadModule,
  loadingState,
  children
}: AuthoringBootstrapEntryProps<BootstrapRequest, BootstrapData>) {
  const [bootstrapData, setBootstrapData] = useState<BootstrapData | null>(null);

  useEffect(() => {
    let active = true;

    setBootstrapData(null);
    if (preloadModule) {
      void preloadModule();
    }
    void loadBootstrap(bootstrapRequest).then((nextBootstrapData) => {
      if (!active) {
        return;
      }

      setBootstrapData(nextBootstrapData);
    });

    return () => {
      active = false;
    };
  }, [bootstrapRequest, loadBootstrap, preloadModule]);

  if (!bootstrapData) {
    return <>{loadingState}</>;
  }

  return <>{children(bootstrapData)}</>;
}
