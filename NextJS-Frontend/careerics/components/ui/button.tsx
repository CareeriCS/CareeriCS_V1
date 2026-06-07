"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "secondary-inverted"
  | "outline"
  | "ghost"
  | "danger"
  | "text"
  | "primary-inverted"
  | "popup"
  | "popup-inverted";

type ButtonSize = "sm" | "md" | "lg" | "icon";

interface TextButtonContent {
  before: string;
  buttonText: string;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  textContent?: TextButtonContent;
}

const baseClasses =
  "relative inline-flex shrink-0 grow-0 items-center justify-center gap-[var(--space-sm)] whitespace-nowrap border border-transparent outline-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-color)] disabled:pointer-events-none disabled:opacity-60";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[var(--button-height-sm)] px-[var(--space-lg)] py-[var(--button-padding-y)] text-[length:var(--text-sm)]",
  md: "min-h-[var(--button-height-md)] px-[var(--button-padding-x)] py-[var(--button-padding-y)] text-[length:var(--text-base)]",
  lg: "min-h-[var(--button-height-lg)] px-[var(--space-2xl)] py-[var(--button-padding-y)] text-[length:var(--text-md)]",
  icon: "h-[var(--min-touch-target)] w-[var(--min-touch-target)] p-0 text-[length:var(--text-base)]",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-bg-hover)]",
  secondary:
    "bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-bg-hover)]",
  "secondary-inverted":
    "bg-[var(--button-secondary-inverted-bg)] text-[var(--button-secondary-inverted-text)] hover:bg-[var(--button-secondary-inverted-bg-hover)]",
  outline:
    "border-[var(--button-outline-border)] bg-[var(--button-outline-bg)] text-[var(--button-outline-text)] hover:bg-[var(--button-outline-bg-hover)] hover:text-[var(--button-outline-text-hover)]",
  ghost:
    "bg-[var(--button-ghost-bg)] text-[var(--button-ghost-text)] hover:bg-[var(--button-ghost-bg-hover)]",
  danger:
    "bg-[var(--button-danger-bg)] text-[var(--button-danger-text)] hover:bg-[var(--button-danger-bg-hover)]",
  text:
    "min-h-0 border-0 bg-transparent p-0 text-[var(--primary-green)] underline-offset-4 hover:text-[var(--white)] hover:underline",
  "primary-inverted":
    "bg-[var(--light-green)] text-[var(--dark-blue)] hover:bg-[var(--primary-green)]",
  popup:
    "bg-[var(--button-popup-bg)] text-[var(--button-popup-text)] hover:bg-[var(--button-popup-bg-hover)] hover:text-[var(--button-popup-text-hover)]",
  "popup-inverted":
    "bg-[var(--white)] text-[var(--dark-blue)] hover:bg-[var(--medium-blue)] hover:text-[var(--white)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      className,
      style,
      textContent,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isInteractionDisabled = disabled || isLoading;

    const buttonClassName = cn(
      baseClasses,
      "rounded-[var(--button-radius)] font-medium leading-none",
      sizeClasses[size],
      variantClasses[variant],
      className
    );

    const sharedStyle = {
      fontFamily: "var(--font-nova-square), sans-serif",
      ...style,
    };

    if (variant === "text" && textContent) {
      return (
        <p
          className="m-0 inline-flex flex-wrap items-center gap-x-1 text-[length:var(--text-sm)] text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
        >
          <span>{textContent.before}</span>
          <button
            ref={ref}
            type={type}
            disabled={isInteractionDisabled}
            className={cn(
              baseClasses,
              variantClasses.text,
              "inline min-h-0 rounded-none p-0 text-[length:inherit] font-normal leading-[inherit]",
              className
            )}
            style={sharedStyle}
            {...props}
          >
            {textContent.buttonText}
          </button>
        </p>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={isInteractionDisabled}
        className={buttonClassName}
        style={sharedStyle}
        {...props}
      >
        {isLoading && (
          <svg
            className="h-[var(--icon-sm)] w-[var(--icon-sm)] animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth={4}
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}

        {children}
      </button>
    );
  }
);

Button.displayName = "Button";