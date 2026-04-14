import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-muted pb-20 md:pb-0">
      <div className="max-w-md mx-auto px-4 pt-6 pb-8">
        <div className="bg-card rounded-brand shadow-card p-6 space-y-4">
          {/* Heart icon */}
          <div className="flex justify-center">
            <Skeleton className="w-16 h-16 rounded-full" />
          </div>
          {/* Title */}
          <Skeleton className="h-6 w-40 mx-auto" />
          {/* Subtitle */}
          <Skeleton className="h-4 w-56 mx-auto" />
          {/* Info block */}
          <Skeleton className="h-16 w-full rounded-xl" />
          {/* Prenom field */}
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full rounded-lg" />
          {/* Email field */}
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-12 w-full rounded-lg" />
          {/* Choice buttons */}
          <Skeleton className="h-4 w-52" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </div>
          {/* Textarea */}
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-24 w-full rounded-lg" />
          {/* Button */}
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
