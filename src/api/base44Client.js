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
let writeQueue = Promise.resolve();

function isRateLimitError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429');
}

async function runWithRetry(fn) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRateLimitError(err) || attempt === 8) break;
      await sleep(1500 * attempt * attempt);
    }
  }
  throw lastError;
}

function queueWrite(fn) {
  const task = writeQueue.then(async () => {
    const result = await runWithRetry(fn);
    await sleep(900);
    return result;
  });
  writeQueue = task.catch(() => {});
  return task;
}

function patchEntityWrites(client) {
  if (!client?.entities || client.__asadazoWriteThrottlePatched) return client;

  for (const entity of Object.values(client.entities)) {
    if (!entity || entity.__asadazoWritePatched) continue;

    if (entity.create) {
      const originalCreate = entity.create.bind(entity);
      entity.create = (payload) => queueWrite(() => originalCreate(payload));
    }

    if (entity.update) {
      const originalUpdate = entity.update.bind(entity);
      entity.update = (id, payload) => queueWrite(() => originalUpdate(id, payload));
    }

    if (entity.delete) {
      const originalDelete = entity.delete.bind(entity);
      entity.delete = (id) => queueWrite(() => originalDelete(id));
    }

    entity.__asadazoWritePatched = true;
  }

  client.__asadazoWriteThrottlePatched = true;
  return client;
}

export const base44 = patchEntityWrites(rawBase44);
