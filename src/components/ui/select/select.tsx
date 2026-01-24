'use client';

import type { FC } from 'react';
import { ChevronDown, Check } from '@untitledui/icons';
import type {
  ListBoxItemProps as AriaListBoxItemProps,
  SelectProps as AriaSelectProps,
} from 'react-aria-components';
import {
  Button as AriaButton,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  Popover as AriaPopover,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
} from 'react-aria-components';
import { cx } from '@/utils/cx';

interface SelectProps<T extends object> extends Omit<AriaSelectProps<T>, 'className'> {
  /** Additional CSS classes for the trigger button. */
  className?: string;
  /** If true, shows an error state. */
  isInvalid?: boolean;
}

export function Select<T extends object>({
  children,
  className,
  isInvalid,
  ...props
}: SelectProps<T>) {
  return (
    <AriaSelect {...props}>
      {(state) => (
        <>
          <AriaButton
            className={cx(
              'flex h-10 w-full items-center justify-between rounded-lg border bg-primary px-3 text-sm outline-focus-ring transition duration-100',
              state.isOpen && 'border-brand-solid ring-4 ring-brand-secondary',
              !state.isOpen && !isInvalid && 'border-primary hover:border-primary_hover',
              isInvalid && 'border-error-solid ring-4 ring-error-secondary',
              state.isDisabled && 'cursor-not-allowed opacity-50',
              className
            )}
          >
            <AriaSelectValue className="truncate text-primary placeholder:text-placeholder" />
            <ChevronDown
              aria-hidden="true"
              className={cx(
                'size-5 shrink-0 text-fg-quaternary transition-transform duration-200',
                state.isOpen && 'rotate-180'
              )}
            />
          </AriaButton>
          <AriaPopover
            className={cx(
              'w-(--trigger-width) overflow-auto rounded-lg bg-primary shadow-lg ring-1 ring-secondary_alt',
              'entering:duration-150 entering:ease-out entering:animate-in entering:fade-in entering:slide-in-from-top-0.5',
              'exiting:duration-100 exiting:ease-in exiting:animate-out exiting:fade-out exiting:slide-out-to-top-0.5'
            )}
          >
            <AriaListBox className="max-h-60 overflow-y-auto p-1 outline-hidden">
              {children}
            </AriaListBox>
          </AriaPopover>
        </>
      )}
    </AriaSelect>
  );
}

interface SelectItemProps extends AriaListBoxItemProps {
  /** An icon to be displayed on the left side of the item. */
  icon?: FC<{ className?: string }>;
}

function SelectItem({ children, icon: Icon, ...props }: SelectItemProps) {
  return (
    <AriaListBoxItem
      {...props}
      className={(state) =>
        cx(
          'group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-hidden transition duration-100',
          state.isFocused && 'bg-primary_hover',
          state.isSelected && 'bg-secondary text-primary font-medium',
          !state.isSelected && 'text-secondary',
          state.isDisabled && 'cursor-not-allowed opacity-50',
          typeof props.className === 'function' ? props.className(state) : props.className
        )
      }
    >
      {(state) => (
        <>
          {Icon && (
            <Icon
              aria-hidden="true"
              className="size-4 shrink-0 stroke-[2.25px] text-fg-quaternary"
            />
          )}
          <span className="flex-1 truncate">
            {typeof children === 'function' ? children(state) : children}
          </span>
          {state.isSelected && (
            <Check
              aria-hidden="true"
              className="size-4 shrink-0 stroke-[2.5px] text-brand-solid"
            />
          )}
        </>
      )}
    </AriaListBoxItem>
  );
}

Select.Item = SelectItem;
