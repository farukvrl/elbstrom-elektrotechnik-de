"use client";

import { useEffect, useState } from "react";

/**
 * ReachabilityBadge
 *
 * Renders a "Currently available" badge only during business hours.
 * Evaluated client-side to avoid SSR/timezone mismatch.
 *
 * Business hours: Monday – Friday, 08:00 – 17:00 (local time).
 */
export default function ReachabilityBadge() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const now      = new Date();
    const day      = now.getDay();   // 0 = Sun … 6 = Sat
    const hour     = now.getHours();
    const isWeekday       = day >= 1 && day <= 5;
    const isDuringHours   = hour >= 8 && hour < 17;

    setIsOpen(isWeekday && isDuringHours);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="availability-badge">
      <span className="availability-badge__dot" />
      <span className="availability-badge__text">
        <strong>Currently available</strong>
        Mon – Fri · 08:00 – 17:00
      </span>
    </div>
  );
}
