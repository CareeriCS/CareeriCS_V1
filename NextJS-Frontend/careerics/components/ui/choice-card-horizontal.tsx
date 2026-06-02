import React from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type ChoiceCardHorizontalProps = {
  icon: string;
  title: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
  buttonLoadingText?: string;
  isLoading?: boolean;
  buttonVariant?: "primary-inverted" | "primary";
  style?: React.CSSProperties;
  route?: string;
};

export default function ChoiceCardHorizontal({
  icon,
  title,
  description,
  buttonText = "Start",
  onButtonClick,
  buttonDisabled,
  buttonLoadingText = "Loading...",
  isLoading,
  buttonVariant = "primary-inverted",
  route,
  style,
}: ChoiceCardHorizontalProps) {
  const router = useRouter();


   const handleButtonClick = () => {
    if (onButtonClick) {
      onButtonClick();
    } else if (route) {
      router.push(route);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#16203d",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "var(--space-md)",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-lg)",
          minWidth: 0,
          flex: 1,
          height: "100%",
        }}
      >
        <img
          src={icon}
          alt=""
          style={{
            height: "var(--icon-4xl)",
          }}
        />

        <div
          style={{
            height: "80%",
            width: "0.2rem",
            backgroundColor: "white",
            flexShrink: 0,
            flexGrow: 0,
            alignItems: "center",
            display: "flex",
            borderRadius: "999px",
          }}
        />

        <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          flex: 1,
          minWidth: 0,
        }}
        >
          <h3
            style={{
              color: "white",
              fontSize: "var(--text-md)",
              fontFamily: "var(--font-nova-square)",
              fontWeight: "200",
            }}
          >
            {title}
          </h3>

          <p
            style={{
              color: "white",
              fontSize: "var(--text-base)",
            }}
          >
            {description}
          </p>
          <Button
            variant={buttonVariant}
            onClick={handleButtonClick}
            disabled={buttonDisabled || isLoading}
            style={{
              marginLeft: "auto",
            }}
          >
            {isLoading ? buttonLoadingText : buttonText}
          </Button>
        </div>
      </div>

    </div>
  );
}