import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { FeedCursor } from '@/db/repositories/jobs-repository';
import type { SavedListKind } from '@/db/repositories/personal-repository';
import type { PersonalStatus } from '@/domain/job';
import type { JobFilter } from '@/domain/saved-search';
import * as service from '@/services/jobs-service';

export function useFeed(filter: JobFilter, newSince: string) {
  return useInfiniteQuery({
    queryKey: ['feed', filter, newSince],
    queryFn: ({ pageParam }) => service.fetchFeedPage(filter, newSince, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useFeedCount(filter: JobFilter) {
  return useQuery({ queryKey: ['count', 'all', filter], queryFn: () => service.fetchFeedCount(filter) });
}

export function useNewCount(filter: JobFilter, newSince: string) {
  return useQuery({ queryKey: ['count', 'new', filter, newSince], queryFn: () => service.fetchNewCount(filter, newSince) });
}

export function useJobDetail(id: number) {
  return useQuery({ queryKey: ['job', id], queryFn: () => service.fetchJobDetail(id) });
}

export function useSavedList(kind: SavedListKind) {
  return useQuery({ queryKey: ['saved', kind], queryFn: () => service.fetchSaved(kind) });
}

/** Kişisel veri değişince ilgili tüm listeler tazelenir. DB yerel olduğu için anında. */
function useInvalidatePersonal() {
  const qc = useQueryClient();
  return (id: number) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['job', id] }),
      qc.invalidateQueries({ queryKey: ['feed'] }),
      qc.invalidateQueries({ queryKey: ['saved'] }),
      qc.invalidateQueries({ queryKey: ['count'] }),
    ]);
}

export function useJobActions() {
  const invalidate = useInvalidatePersonal();
  const favorite = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) => service.toggleFavorite(id, value),
    onSuccess: (_d, v) => invalidate(v.id),
  });
  const hide = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) => service.setHidden(id, value),
    onSuccess: (_d, v) => invalidate(v.id),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: number; value: PersonalStatus | null }) => service.setStatus(id, value),
    onSuccess: (_d, v) => invalidate(v.id),
  });
  const note = useMutation({
    mutationFn: ({ id, value }: { id: number; value: string }) => service.setNote(id, value),
    onSuccess: (_d, v) => invalidate(v.id),
  });
  return { favorite, hide, status, note };
}
