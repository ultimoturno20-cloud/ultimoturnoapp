import { useEffect, useState } from "react";
import { normalizeOperationalPreferences, readOperationalPreferences, writeOperationalPreferences, type OperationalPreferences, type OperationalSection } from "./operational-preferences.js";

function storage() {
  try { return window.localStorage; } catch { return undefined; }
}
export function useOperationalPreferences<T extends OperationalSection>(scope: string, section: T) {
  const [record, setRecord] = useState(() => ({ scope, section, current: readOperationalPreferences(storage(), scope, section) }));
  const state = record.scope === scope && record.section === section ? record.current : readOperationalPreferences(storage(), scope, section);
  useEffect(() => {
    if (record.scope !== scope || record.section !== section) {
      setRecord({ scope, section, current: readOperationalPreferences(storage(), scope, section) });
      return;
    }
    writeOperationalPreferences(storage(), scope, section, record.current);
  }, [scope, section, record]);
  const patch = (value: Partial<OperationalPreferences[T]>) => setRecord((current) => ({ scope, section, current: normalizeOperationalPreferences(section, {
    ...(current.scope === scope && current.section === section ? current.current : readOperationalPreferences(storage(), scope, section)), ...value
  }) }));
  const reset = () => setRecord({ scope, section, current: normalizeOperationalPreferences(section, null) });
  return [state, patch, reset] as const;
}
