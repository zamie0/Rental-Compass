import { cn } from "@/lib/utils";
import { initialsFrom, useProfile } from "@/lib/profile";

interface Props {
  size?: number;
  className?: string;
  ring?: boolean;
}

export function UserAvatar({ size = 40, className, ring = false }: Props) {
  const { data } = useProfile();
  const url = data?.avatarSignedUrl;
  const initials = initialsFrom(data?.display_name, data?.email);

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-brand-foreground font-bold",
        ring && "ring-2 ring-background",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
