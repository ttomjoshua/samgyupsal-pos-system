const resourceCache = new Map()

// Cache entries are treated as immutable resource snapshots to avoid
// deep-cloning large datasets on every read/write during navigation.

export function getCachedResource(cacheKey, maxAgeMs = Infinity) {
  const cacheEntry = resourceCache.get(cacheKey)

  if (!cacheEntry) {
    return null
  }

  if (Date.now() - cacheEntry.cachedAt > maxAgeMs) {
    resourceCache.delete(cacheKey)
    return null
  }

  return cacheEntry.value
}

export function setCachedResource(cacheKey, value) {
  resourceCache.set(cacheKey, {
    value,
    cachedAt: Date.now(),
  })

  return value
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
