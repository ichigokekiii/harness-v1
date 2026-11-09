import { cn } from "@/lib/cn";

const lessonPhotos = ["/lesson/lesson-notebook.jpg", "/lesson/lesson-books.jpg", "/lesson/lesson-desk.jpg"];

export function lessonCover(index: number) {
  return lessonPhotos[index % lessonPhotos.length];
}

export function FileCard({
  title,
  detail,
  preview,
  image,
  slide,
  fit = "cover",
  compact = false,
}: {
  title: string;
  detail?: string;
  preview: string;
  image?: string;
  slide?: { kicker: string; title: string };
  fit?: "cover" | "contain";
  compact?: boolean;
}) {
  return (
    <div className="w-full min-w-0">
      <div className={cn("ml-2.5 rounded-t-md bg-soft", compact ? "h-2 w-10" : "h-2.5 w-14")} aria-hidden />
      <div className={cn("rounded-xl rounded-tl-sm bg-soft", compact ? "p-1.5" : "p-2")}>
        <div
          className={cn(
            "overflow-hidden rounded-md bg-white text-[#26251e] shadow-[0_1px_2px_rgb(38_37_30/8%)]",
            compact ? "h-14" : "aspect-[5/3]",
            !image && (compact ? "px-2 py-1.5" : "px-3 py-2.5"),
          )}
        >
          {slide && image ? (
            <div className="grid h-full grid-cols-[1.15fr_0.85fr] bg-[#26251e] text-white">
              <div className="flex flex-col justify-center px-3">
                <p className="text-[9px] text-white/70">{slide.kicker}</p>
                <p className="mt-1 text-[14px] font-semibold leading-4">{slide.title}</p>
              </div>
              <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} aria-hidden />
            </div>
          ) : image ? (
            <div
              className={cn("h-full w-full bg-center", fit === "contain" ? "bg-contain bg-no-repeat" : "bg-cover")}
              style={{ backgroundImage: `url(${image})` }}
              aria-hidden
            />
          ) : (
            <>
              <p className={cn("line-clamp-3 font-medium leading-4", compact ? "text-[10px]" : "text-[11px]")}>{preview}</p>
              {compact ? null : (
                <div className="mt-2 space-y-1.5" aria-hidden>
                  <div className="h-1 w-full rounded-full bg-black/10" />
                  <div className="h-1 w-10/12 rounded-full bg-black/10" />
                  <div className="h-1 w-7/12 rounded-full bg-black/[0.07]" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <p className={cn("truncate px-0.5 font-medium", compact ? "mt-1.5 text-[12px]" : "mt-2 text-[13px]")}>{title}</p>
      {detail ? <p className="truncate px-0.5 text-[12px] text-muted">{detail}</p> : null}
    </div>
  );
}
