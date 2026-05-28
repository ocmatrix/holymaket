import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
export function useMarkets() {
    const { data: markets, isLoading, error, refetch } = useQuery({
        queryKey: ["markets"],
        queryFn: () => api.getMarkets(),
        refetchInterval: 30000,
    });
    return {
        markets: markets || [],
        isLoading,
        error,
        refetch
    };
}
