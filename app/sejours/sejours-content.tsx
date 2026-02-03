'use client';

import { HomeContent } from '../home-content';
import type { Stay } from '@/lib/types';

interface SejoursContentProps {
  stays: Stay[];
}

// Wrapper component that delegates to HomeContent
// Used by page.tsx (home) to render the catalogue
export function SejoursContent({ stays }: SejoursContentProps) {
  return <HomeContent stays={stays} hideInternalSearch={false} />;
}
