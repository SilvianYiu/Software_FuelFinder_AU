import { Sun, Moon, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallButton } from "./InstallPrompt";

interface HeaderProps {
  isDark: boolean;
  onToggleDark: () => void;
}

export function Header({ isDark, onToggleDark }: HeaderProps) {
  return (
    <header className="border-b border-border bg-card px-4 py-2.5">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Fuel className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight tracking-tight">
              FuelFinder
              <span className="text-primary ml-1">AU</span>
            </h1>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
              Real-time fuel prices · Western Australia
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InstallButton />
          <span className="text-xs text-muted-foreground hidden sm:inline mr-1">
            WA FuelWatch
          </span>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8"
            onClick={onToggleDark}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            data-testid="button-theme-toggle"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
