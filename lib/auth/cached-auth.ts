import { cache } from 'react';
import { auth as nextAuth } from '@/lib/auth/config';

/** Request-scoped memoization — deduplicates auth() across layout, pages, and guards. */
export const getCachedSession = cache(async () => nextAuth());
