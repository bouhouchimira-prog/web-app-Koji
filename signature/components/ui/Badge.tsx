import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80":
            variant === "default",
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80":
            variant === "secondary",
          "text-foreground": variant === "outline",
          "border-transparent bg-red-500 text-white shadow hover:bg-red-500/80": variant === "destructive",
          "border-transparent bg-green-500 text-white shadow hover:bg-green-500/80": variant === "success",
          "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-500/80": variant === "warning",
        },
        className
      )}
      {...props}
    />
  );
}
