import { useEffect, useState } from "react";

// Waits until the user stops typing before the value changes
// (search sends one request instead of one per keystroke)
export const useDebounce = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};
