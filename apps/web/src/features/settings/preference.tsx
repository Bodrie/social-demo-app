import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export type PreferenceProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** One switch of Settings: the label names it, the description says what it does. */
export function Preference({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: PreferenceProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
