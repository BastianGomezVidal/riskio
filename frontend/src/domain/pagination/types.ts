/** Standard paginated response envelope used across all list endpoints. */
export interface Paginated<T> {
  meta: {
    total: number;
    page: number;
    limit: number;
    pageCount: number;
    hasNextPage: boolean;
  };
  data: T[];
}
