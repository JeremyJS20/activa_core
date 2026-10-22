"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve el valor estabilizado tras `delayMs` sin cambios.
 * El setState ocurre dentro del timer (asíncrono), cumpliendo las reglas
 * del React Compiler de Next.js 16.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
