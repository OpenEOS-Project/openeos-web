"use client";

import type { ChangeEvent, Ref } from "react";
import { forwardRef } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "./input";
import type { InputBaseProps } from "./input";

/**
 * A wrapper around the Input component that supports react-hook-form's register pattern.
 * Use this component when you need to use {...register('fieldName')} with forms.
 */

interface FormInputProps extends Omit<InputBaseProps, "onChange" | "onBlur" | "ref" | "name"> {
  /** react-hook-form register return value, spread with {...register('fieldName')} */
  name?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Label text for the input */
  label?: string;
  /** Helper text displayed below the input */
  hint?: string;
  /** Whether to hide required indicator from label */
  hideRequiredIndicator?: boolean;
  /** Class name for the wrapper */
  className?: string;
  /** Ref for the input element */
  ref?: Ref<HTMLInputElement>;
  /** Input type */
  type?: string;
  /** Min value for number inputs */
  min?: string | number;
  /** Max value for number inputs */
  max?: string | number;
  /** Step value for number inputs */
  step?: string | number;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Autocomplete attribute */
  autoComplete?: string;
  /** Autofocus attribute */
  autoFocus?: boolean;
  /** Max length */
  maxLength?: number;
  /** ID for the input */
  id?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      onChange,
      onBlur,
      name,
      type,
      min,
      max,
      step,
      disabled,
      autoComplete,
      autoFocus,
      maxLength,
      id,
      label,
      hint,
      hideRequiredIndicator,
      className,
      placeholder,
      isInvalid,
      icon,
      tooltip,
      size,
      shortcut,
      iconClassName,
      inputClassName,
      wrapperClassName,
      tooltipClassName,
      ...props
    },
    ref
  ) => {
    // Adapter function to convert react-hook-form's onChange to react-aria's onChange
    const handleChange = (value: string) => {
      if (onChange) {
        // Create a synthetic event-like object for react-hook-form
        const syntheticEvent = {
          target: {
            name,
            value,
            type: type || "text",
          },
        } as ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const handleBlur = () => {
      if (onBlur) {
        const syntheticEvent = {
          target: {
            name,
            value: "",
            type: type || "text",
          },
        } as ChangeEvent<HTMLInputElement>;
        onBlur(syntheticEvent);
      }
    };

    return (
      <Input
        ref={ref}
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        isInvalid={isInvalid}
        isDisabled={disabled}
        label={label}
        hint={hint}
        hideRequiredIndicator={hideRequiredIndicator}
        className={className}
        icon={icon}
        tooltip={tooltip}
        size={size}
        shortcut={shortcut}
        iconClassName={iconClassName}
        inputClassName={inputClassName}
        wrapperClassName={wrapperClassName}
        tooltipClassName={tooltipClassName}
        onChange={handleChange}
        onBlur={handleBlur}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        {...(type === "number" && { minValue: min as number, maxValue: max as number })}
        {...props}
      />
    );
  }
);

FormInput.displayName = "FormInput";
