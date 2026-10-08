'use strict';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

function isLoopbackOrigin(origin) {
  try {
    const url = origin instanceof URL ? origin : new URL(String(origin));
    return (url.protocol === 'http:' || url.protocol === 'https:') && LOOPBACK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function createLoopbackDispatcher(directDispatcher, proxyDispatcher) {
  if (!directDispatcher?.dispatch || !proxyDispatcher?.dispatch) {
    throw new TypeError('Sono richiesti dispatcher direct e proxy');
  }

  return {
    dispatch(options, handler) {
      const dispatcher = isLoopbackOrigin(options?.origin)
        ? directDispatcher
        : proxyDispatcher;
      return dispatcher.dispatch(options, handler);
    },
    async close() {
      await Promise.all([directDispatcher.close?.(), proxyDispatcher.close?.()]);
    },
    async destroy(error) {
      await Promise.all([
        directDispatcher.destroy?.(error),
        proxyDispatcher.destroy?.(error),
      ]);
    },
  };
}

function install() {
  if (process.env.STORAGE_EMULATOR_LOOPBACK_DIRECT !== '1') return;

  const undici = require('undici');
  const OriginalProxyAgent = undici.ProxyAgent;

  undici.ProxyAgent = class LoopbackAwareProxyAgent {
    constructor(options) {
      return createLoopbackDispatcher(
        new undici.Agent(),
        new OriginalProxyAgent(options),
      );
    }
  };
}

module.exports = {createLoopbackDispatcher, install, isLoopbackOrigin};

install();
