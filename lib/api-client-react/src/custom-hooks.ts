import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { customFetch, type CustomFetchOptions } from "./custom-fetch";

export function useCustomFetch<TData = any, TError = any>(
  url: string,
  options?: UseQueryOptions<TData, TError> & { fetchOptions?: CustomFetchOptions }
) {
  const { fetchOptions, ...queryOptions } = options || {};
  return useQuery<TData, TError>({
    queryKey: [url, fetchOptions],
    queryFn: () => customFetch<TData>(`/api${url}`, fetchOptions),
    ...queryOptions,
  });
}

export function useCustomMutation<TData = any, TError = any, TVariables = any>(
  url: string,
  options?: UseMutationOptions<TData, TError, TVariables> & { fetchOptions?: CustomFetchOptions }
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
