import { cn } from 'cn';
import { SearchIcon } from 'lucide-react';
import { type FormEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '@/components/ui/input';
import { searchDestination } from './search-destination';

type SearchBoxProps = { className?: string; onSubmitted?: () => void };

/** The header's search field: Enter navigates, the field clears. */
export function SearchBox({ className, onSubmitted }: SearchBoxProps) {
  const navigate = useNavigate();
  const id = useId();
  const [value, setValue] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const destination = searchDestination(value);
    if (!destination) return;
    void navigate(destination);
    setValue('');
    onSubmitted?.();
  };

  return (
    <search aria-label="Site" className={cn('relative', className)}>
      <form onSubmit={submit}>
        <label htmlFor={id} className="sr-only">
          Search
        </label>
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          placeholder="Search posts and people"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="bg-background/60 pl-9"
        />
      </form>
    </search>
  );
}
