"use client";

import type { ChangeEvent, ReactNode, Ref } from "react";
import { forwardRef } from "react";
import { Input } from "./input";

interface FormInputProps {
  name?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  hint?: ReactNode;
  hideRequiredIndicator?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
  type?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  disabled?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  id?: string;
  placeholder?: string;
  isInvalid?: boolean;
  icon?: any;
  tooltip?: string;
  size?: "sm" | "md";
  shortcut?: string;
  iconClassName?: string;
  inputClassName?: string;
  wrapperClassName?: string;
  tooltipClassName?: string;
  value?: string;
  defaultValue?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
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
    const handleChange = (value: string) => {
      if (onChange) {
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
        {...props}
      />
    );
  }
);

FormInput.displayName = "FormInput";
