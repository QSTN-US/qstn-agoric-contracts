/* global globalThis */
const ambientSetTimeout = globalThis.setTimeout;

const sleep = (ms, { log = _msg => {}, setTimeout = ambientSetTimeout } = {}) =>
  new Promise(resolve => {
    log(`Sleeping for ${ms}ms...`);
    setTimeout(resolve, ms);
  });

const retryUntilCondition = async (
  operation,
  condition,
  message,
  {
    maxRetries = 6,
    retryIntervalMs = 3500,
    log = _msg => {},
    setTimeout = ambientSetTimeout,
  } = {},
) => {
  console.log({ maxRetries, retryIntervalMs, message });
  let retries = 0;

  await null;
  while (retries < maxRetries) {
    try {
      const result = await operation();
      if (condition(result)) {
        return result;
      }
    } catch (error) {
      if (error instanceof Error) {
        log(`Error: ${error.message}`);
      } else {
        log(`Unknown error: ${String(error)}`);
      }
    }

    // eslint-disable-next-line no-plusplus
    retries++;
    console.log(
      `Retry ${retries}/${maxRetries} - Waiting for ${retryIntervalMs}ms for ${message}...`,
    );
    await sleep(retryIntervalMs, { log, setTimeout });
  }

  throw new Error(`${message} condition failed after ${maxRetries} retries.`);
};

const makeRetryUntilCondition = (defaultOptions = {}) => {
  return (operation, condition, message, options) =>
    retryUntilCondition(operation, condition, message, {
      ...defaultOptions,
      ...options,
    });
};

export { sleep, makeRetryUntilCondition };
