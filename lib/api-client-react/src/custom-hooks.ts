import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { customFetch, type CustomFetchOptions } from "./custom-fetch";

export function useCustomFetch<TData = any, TError = any>(
  url: string,
  options?: Omit<UseQueryOptions<TData, TError>, "queryKey" | "queryFn"> & { fetchOptions?: CustomFetchOptions }
) {
  const { fetchOptions, ...queryOptions } = options || {};
  return useQuery<TData, TError>({
    queryKey: [url, fetchOptions],
    queryFn: () => customFetch<TData>(`/api${url}`, fetchOptions),
    ...queryOptions as any,
  });
}

export function useCustomMutation<TData = any, TError = any, TVariables = any>(
  url: string,
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, "mutationFn"> & { fetchOptions?: CustomFetchOptions }
) {
  const { fetchOptions, ...mutationOptions } = options || {};
  return useMutation<TData, TError, TVariables>({
    mutationFn: (variables) => 
      customFetch<TData>(`/api${url}`, {
        ...fetchOptions,
        body: JSON.stringify(variables),
      }),
    ...mutationOptions,
  });
}
