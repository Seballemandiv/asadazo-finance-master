import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const rawBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let createQueue = Promise.resolve();

function isRateLimitError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429');
}

async function runWithRetry(fn) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRateLimitError(err) || attempt === 6) break;
      await sleep(700 * attempt * attempt);
    }
  }
  throw lastError;
}

function patchEntityCreates(client) {
  if (!client?.entities || client.__asadazoCreateThrottlePatched) return client;

  for (const entity of Object.values(client.entities)) {
    if (!entity?.create || entity.__asadazoCreatePatched) continue;
    const originalCreate = entity.create.bind(entity);
    entity.create = (payload) => {
      const task = createQueue.then(async () => {
        const result = await runWithRetry(() => originalCreate(payload));
        await sleep(120);
        return result;
      });
      createQueue = task.catch(() => {});
      return task;
    };
    entity.__asadazoCreatePatched = true;
  }

  client.__asadazoCreateThrottlePatched = true;
  return client;
}

// Export a patched client so large imports do not burst-create hundreds of rows at once.
export const base44 = patchEntityCreates(rawBase44);
