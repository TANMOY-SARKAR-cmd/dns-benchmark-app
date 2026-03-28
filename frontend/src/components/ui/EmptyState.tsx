import { LucideIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
      <Icon className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
      <h4 className="text-sm font-medium text-slate-900 dark:text-slate-200">
        {title}
      </h4>
      <p className="text-sm text-slate-500 mt-1 ">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4" variant="outline">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
