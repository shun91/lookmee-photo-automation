import fetchRetryable from "fetch-retry";

/**
 * Fetch with retry
 */
export const fetchRetry = fetchRetryable(fetch, {
  retries: 6,
  // Exponential backoff
  retryDelay: (attempt) => Math.pow(2, attempt) * 1000,
  retryOn: (attempt, error, response) => {
    // retry on any network error, or 4xx or 5xx status codes
    if (
      error !== null ||
      !response ||
      response.status >= 500 ||
      response.status === 429
    ) {
      console.log(`retrying, attempt number ${attempt + 1}`);
      return true;
    }
    return false;
  },
});
