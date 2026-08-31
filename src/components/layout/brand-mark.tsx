import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className
      )}
    >
      <span className="font-black italic leading-none tracking-tighter" style={{ fontSize: "1.15em" }}>
        Z
      </span>
    </div>
  );
}
