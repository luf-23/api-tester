import * as Checkbox from '@radix-ui/react-checkbox'
import { IconCheck } from './icons'

interface Props {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  'aria-label': string
}

export function KvCheckbox({ checked, onCheckedChange, 'aria-label': ariaLabel }: Props) {
  return (
    <Checkbox.Root
      className="kv-checkbox"
      checked={checked}
      onCheckedChange={(state) => onCheckedChange(state === true)}
      aria-label={ariaLabel}
    >
      <Checkbox.Indicator className="kv-checkbox__indicator">
        <IconCheck width={13} height={13} strokeWidth={2.2} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}
