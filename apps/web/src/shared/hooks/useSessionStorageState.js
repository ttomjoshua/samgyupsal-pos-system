import { useEffect, useState } from 'react'
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from '../utils/storage'

function resolveInitialValue(initialValue) {
  return typeof initialValue === 'function' ? initialValue() : initialValue
}

export default function useSessionStorageState(storageKey, initialValue) {
  const [value, setValue] = useState(() =>
    readSessionStorageValue(storageKey, resolveInitialValue(initialValue)),
  )

  useEffect(() => {
    if (value === undefined) {
      removeSessionStorageValue(storageKey)
      return
    }

    writeSessionStorageValue(storageKey, value)
  }, [storageKey, value])

  return [value, setValue]
}
