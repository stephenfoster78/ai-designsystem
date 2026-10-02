"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { SessionTimeout } from "@qf/design-system";
import { endSession, extendSession } from "@/app/quote/actions";

export function SessionTimeoutHost({ remainingMs, warningMs }: { remainingMs: number; warningMs: number }) {
  const router = useRouter();
  const end = useCallback(async () => {
    try {
      await endSession();
    } finally {
      router.replace("/quote/session-ended");
    }
  }, [router]);

  return <SessionTimeout remainingMs={remainingMs} warningMs={warningMs} onExtend={extendSession} onExpire={end} onEnd={end} />;
}
