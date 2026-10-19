import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { isApiClientError } from '@/lib/api/client';

/**
 * Maps the API error envelope onto a react-hook-form instance: every `fields`
 * entry that names a form field becomes a field error, anything else is toasted.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: Path<T>[],
): void {
  if (!isApiClientError(error)) {
    toast.error('Something went wrong. Please try again.');
    return;
  }
  let attached = false;
  for (const name of fieldNames) {
    const message = error.fields[name];
    if (message) {
      // The first field with a problem takes focus, so the message is heard (aria-describedby).
      setError(name, { type: 'server', message }, { shouldFocus: !attached });
      attached = true;
    }
  }
  if (!attached) toast.error(error.message);
}
