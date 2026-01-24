'use client';

import { type Ref, type ReactNode, forwardRef } from 'react';
import { InfoCircle } from '@untitledui/icons';
import {
  TextField as AriaTextField,
  TextArea as AriaTextArea,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import { HintText } from '@/components/ui/input/hint-text';
import { Label } from '@/components/ui/input/label';
import { cx } from '@/utils/cx';

export interface TextareaProps extends Omit<AriaTextFieldProps, 'children'> {
  /** Label text for the textarea */
  label?: string;
  /** Helper text displayed below the textarea */
  hint?: ReactNode;
  /** Error message to display */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Number of visible text lines */
  rows?: number;
  /** Reference to the textarea element */
  ref?: Ref<HTMLTextAreaElement>;
  /** Whether to hide required indicator from label */
  hideRequiredIndicator?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      hint,
      error,
      placeholder,
      rows = 3,
      hideRequiredIndicator,
      className,
      isDisabled,
      isRequired,
      isInvalid: isInvalidProp,
      ...props
    },
    ref
  ) => {
    const isInvalid = isInvalidProp || !!error;

    return (
      <AriaTextField
        {...props}
        isDisabled={isDisabled}
        isRequired={isRequired}
        isInvalid={isInvalid}
        aria-label={!label ? placeholder : undefined}
        className={cx('group flex h-max w-full flex-col items-start justify-start gap-1.5', className)}
      >
        {({ isRequired: contextRequired, isInvalid: contextInvalid }) => (
          <>
            {label && (
              <Label isRequired={hideRequiredIndicator ? false : contextRequired}>
                {label}
              </Label>
            )}

            <div className="relative w-full">
              <AriaTextArea
                ref={ref}
                rows={rows}
                placeholder={placeholder}
                className={cx(
                  'w-full rounded-lg bg-primary px-3 py-2 text-md text-primary shadow-xs ring-1 ring-primary ring-inset transition-shadow duration-100 ease-linear',
                  'placeholder:text-placeholder',
                  'focus:ring-2 focus:ring-brand focus:outline-none',
                  'resize-y min-h-[80px]',
                  // Disabled state
                  isDisabled && 'cursor-not-allowed bg-disabled_subtle text-disabled ring-disabled',
                  // Invalid state
                  contextInvalid && 'ring-error_subtle',
                  contextInvalid && 'focus:ring-2 focus:ring-error',
                )}
              />

              {/* Invalid icon */}
              {contextInvalid && (
                <InfoCircle
                  className="pointer-events-none absolute right-3 top-2.5 size-4 text-fg-error-secondary"
                />
              )}
            </div>

            {(hint || error) && (
              <HintText isInvalid={contextInvalid}>
                {error || hint}
              </HintText>
            )}
          </>
        )}
      </AriaTextField>
    );
  }
);

Textarea.displayName = 'Textarea';
