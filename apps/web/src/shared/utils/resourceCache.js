const resourceCache = new Map()

function cloneCacheValue(value) {
  if (value == null) {
    return value
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

export function getCachedResource(cacheKey, maxAgeMs = Infinity) {
  const cacheEntry = resourceCache.get(cacheKey)

  if (!cacheEntry) {
    return null
  }

  if (Date.now() - cacheEntry.cachedAt > maxAgeMs) {
    resourceCache.delete(cacheKey)
    return null
  }

  return cloneCacheValue(cacheEntry.value)
}

export function setCachedResource(cacheKey, value) {
  resourceCache.set(cacheKey, {
    value: cloneCacheValue(value),
    cachedAt: Date.now(),
  })

  return cloneCacheValue(value)
}

export function clearCachedResource(cacheKey) {
  resourceCache.delete(cacheKey)
}

export function clearCachedResourceByPrefix(prefix) {
  for (const cacheKey of resourceCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      resourceCache.delete(cacheKey)
    }
  }
}
