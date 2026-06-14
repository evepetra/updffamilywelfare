import { cn } from "@/lib/utils";

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  fill?: boolean;
}

export function Icon({ name, fill, className, ...rest }: IconProps) {
  return (
    <span
      aria-hidden
      className={cn("material-symbols-outlined", fill && "icon-fill", className)}
      {...rest}
    >
      {name}
    </span>
  );
}