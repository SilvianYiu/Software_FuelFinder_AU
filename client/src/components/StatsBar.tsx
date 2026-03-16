import { TrendingDown, TrendingUp, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsBarProps {
  stats: { min: number; max: number; avg: number; count: number };
  isLoading: boolean;
  fuelLabel: string;
}

export function StatsBar({ stats, isLoading, fuelLabel }: StatsBarProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-4 ml-auto">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  if (stats.count === 0) return null;

  return (
    <div className="flex items-center gap-3 sm:gap-5 ml-auto text-sm">
      <div className="flex items-center gap-1.5" data-testid="stat-lowest">
        <TrendingDown className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        <span className="text-muted-foreground text-xs hidden sm:inline">Low</span>
        <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
          {stats.min.toFixed(1)}¢
        </span>
      </div>
      <div className="flex items-center gap-1.5" data-testid="stat-average">
        <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground text-xs hidden sm:inline">Avg</span>
        <span className="font-medium tabular-nums">
          {stats.avg.toFixed(1)}¢
        </span>
      </div>
      <div className="flex items-center gap-1.5" data-testid="stat-highest">
        <TrendingUp className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
        <span className="text-muted-foreground text-xs hidden sm:inline">High</span>
        <span className="font-medium text-red-500 dark:text-red-400 tabular-nums">
          {stats.max.toFixed(1)}¢
        </span>
      </div>
      <div className="text-xs text-muted-foreground hidden md:block">
        {stats.count} stations
      </div>
    </div>
  );
}
