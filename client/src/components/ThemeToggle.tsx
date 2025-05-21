import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // After component mounts, we can show the theme toggle
  // This prevents hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Toggle theme between light and dark
  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  if (!mounted) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleTheme}
            variant="outline"
            size="icon"
            className="w-9 h-9 rounded-md bg-transparent hover:bg-opacity-10 transition-colors border-gray-700 dark:border-gray-700 dark:hover:border-gray-600 dark:text-gray-300 light:text-gray-700 light:border-gray-300 light:hover:border-gray-400"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? (
              <Moon className="h-[1.2rem] w-[1.2rem]" />
            ) : (
              <Sun className="h-[1.2rem] w-[1.2rem]" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          {theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}