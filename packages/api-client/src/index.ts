export interface HealthResponse {
  status: string;
}

export interface ApiClient {
  health(): Promise<HealthResponse>;
}

/**
 * Hand-written until the OpenAPI generator replaces this module.
 * Run `npm run generate -w @rae/api-client` once the API is publishing openapi.json.
 */
export function createApiClient(baseUrl: string): ApiClient {
  return {
    async health() {
      const response = await fetch(new URL("/api/health", baseUrl));
      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      return (await response.json()) as HealthResponse;
    },
  };
}
