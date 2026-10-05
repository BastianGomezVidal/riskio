import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useSession } from "@/components/providers/session-context";
import type { StormsQuery } from "@/domain/storm";
import type { User } from "@/domain/users";
import {
  dashboardSummaryQuery,
  queryKeys,
  stormAdvisoryQuery,
  stormsListQuery,
} from "./queries";

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function useDashboardSummary() {
  return useQuery(dashboardSummaryQuery);
}

export function useStorms(query: StormsQuery) {
  return useQuery(stormsListQuery(query));
}

export function useStormAdvisory(atcfId: string, advisoryNumber: string) {
  return useQuery(stormAdvisoryQuery(atcfId, advisoryNumber));
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Both profile mutations return the updated user, so the cache is written
 * directly instead of refetched: the response is authoritative and a round
 * trip would only add a window where the UI disagrees with the server.
 *
 * `updateUser` mirrors the same value into the session context, which is the
 * source of truth for "is anyone signed in"; the query cache is the source of
 * truth for the profile itself.
 */
function useProfileMutation<TInput>(
  mutationFn: (input: TInput) => Promise<User>,
) {
  const queryClient = useQueryClient();
  const { updateUser } = useSession();

  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me.all, user);
      updateUser(user);
    },
  });
}

export function useUpdateMe() {
  return useProfileMutation((patch: Parameters<typeof api.updateMe>[0]) =>
    api.updateMe(patch),
  );
}

export function useUploadAvatar() {
  return useProfileMutation((file: File) => api.uploadAvatar(file));
}

export function useDeleteMe() {
  const queryClient = useQueryClient();
  const { signOut } = useSession();

  return useMutation({
    mutationFn: () => api.deleteMe(),
    onSuccess: () => {
      // Nothing about the session survives account deletion, so drop the
      // profile rather than letting it sit in the cache.
      queryClient.removeQueries({ queryKey: queryKeys.me.all });
      signOut();
    },
  });
}

/**
 * Machine tokens for the signed-in account.
 *
 * The list is per-user, so it is refetched whenever the profile changes: a
 * different account in the same tab must not see the previous one's tokens.
 */
/**
 * Create a token and show the plaintext.
 *
 * `onSuccess` does not invalidate: the new token carries a secret the list
 * endpoint cannot produce, so the caller is handed the full object and the
 * cache is refreshed separately once the secret has been displayed. Invalidating
 * first would race the modal's copy button against a refetch.
 */
