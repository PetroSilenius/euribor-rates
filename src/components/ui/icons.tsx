import { ArrowRight, type LucideProps } from 'lucide-react';

import { cn } from '@/lib/utils';

function ArrowRightIcon({ className, ...props }: LucideProps) {
  return (
    <ArrowRight aria-hidden className={cn('size-4', className)} {...props} />
  );
}

export { ArrowRightIcon };
