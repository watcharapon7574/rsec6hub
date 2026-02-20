import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const NewsfeedSkeleton = () => (
  <Card className="overflow-hidden">
    {/* Header: Avatar + Name + Time + Category badge */}
    <CardContent className="p-4 pb-0">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-14 rounded-full shrink-0" />
      </div>
    </CardContent>

    {/* Body: Title + Description + Tags */}
    <CardContent className="px-4 py-2 space-y-2">
      <Skeleton className="h-5 w-3/5" />
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <div className="flex gap-1.5 pt-1">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
    </CardContent>

    {/* Image Grid placeholder */}
    <Skeleton className="h-52 w-full rounded-none" />

    {/* Reaction summary */}
    <div className="flex items-center justify-between px-4 py-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-1">
          <Skeleton className="h-[18px] w-[18px] rounded-full" />
          <Skeleton className="h-[18px] w-[18px] rounded-full" />
        </div>
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>

    {/* Divider */}
    <div className="border-t border-border/50" />

    {/* Action buttons */}
    <div className="flex items-center px-2 py-1">
      <div className="flex-[2] flex items-center justify-center gap-1.5 py-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="w-px h-6 bg-border/50" />
      <div className="flex-[2] flex items-center justify-center gap-1.5 py-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="w-px h-6 bg-border/50" />
      <div className="flex-1 flex items-center justify-center gap-1.5 py-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  </Card>
);

export default NewsfeedSkeleton;
