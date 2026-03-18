"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getAppUrlScheme } from "@/lib/env";

function resolveAppPath(openedUrl: string) {
  try {
    const url = new URL(openedUrl);
    const expectedScheme = `${getAppUrlScheme()}:`;

    if (url.protocol !== expectedScheme) {
      return null;
    }

    const combinedPath = `/${[url.hostname, url.pathname].filter(Boolean).join("/")}`.replace(/\/+/g, "/");
    const search = url.search || "";

    return `${combinedPath}${search}`;
  } catch {
    return null;
  }
}

export function AppUrlListener() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listenerPromise = App.addListener("appUrlOpen", ({ url }) => {
      const appPath = resolveAppPath(url);

      if (!appPath) {
        return;
      }

      router.replace(appPath);
      router.refresh();
    });

    return () => {
      void listenerPromise.then((listener) => listener.remove());
    };
  }, [router]);

  return null;
}
