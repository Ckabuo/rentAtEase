"use client";

import { secondsUntil } from "@rae/domain";
import { useEffect, useState } from "react";

export function useResendCountdown(resendAvailableAt: string | null): number {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    resendAvailableAt ? secondsUntil(resendAvailableAt) : 0,
  );

  useEffect(() => {
    if (!resendAvailableAt) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => setSecondsLeft(secondsUntil(resendAvailableAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [resendAvailableAt]);

  return secondsLeft;
}
