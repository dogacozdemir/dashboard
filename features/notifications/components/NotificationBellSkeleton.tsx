import { Bell } from 'lucide-react';

export function NotificationBellSkeleton() {
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/25 animate-pulse"
      aria-hidden
    >
      <Bell className="h-3.5 w-3.5" />
    </div>
  );
}
