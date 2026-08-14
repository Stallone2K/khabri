import { Skeleton } from "@/components/ui/skeleton";

export function FeedCardSkeleton() {
  return (
    <div className="pb-4 border-b border-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-3 w-14" />
      </div>
      {/* Image */}
      <Skeleton className="w-full aspect-video rounded-md mb-3" />
      {/* Actions */}
      <div className="flex items-center gap-4 mb-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      {/* Text */}
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function FeedGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  );
}
