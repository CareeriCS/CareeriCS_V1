"use client";
import React, { useState, useEffect } from "react";
import { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button"
import { useResponsive } from "@/hooks/useResponsive";

interface AuthLayoutProps {
  children: ReactNode;
}


export default function AuthLayout({ children }: AuthLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Default values
  let CardTitle = "";
  let Message = "";
  let Link = "/";
  let LinkText = "";
  let showDiv = true;
  let BackPath: string | undefined;

  // Route-based conditions
  switch (pathname) {
    case "/auth/login":
      CardTitle = "Welcome Back";
      Message = "Don't have an account?";
      Link = "/auth/register";
      LinkText = "Register";
      showDiv = true;
      BackPath = "/";
      break;

    case "/auth/register":
      CardTitle = "Create Account";
      Message = "Already have an account?";
      Link = "/auth/login";
      LinkText = "Sign In";
      showDiv = true;
      BackPath = "/auth/login";
      break;

    case "/auth/reset-password":
      CardTitle = "Reset Password";
      Message = "Remember your password";
      Link = "/auth/login"
      LinkText = "Sign In Here"
      showDiv = false;
      BackPath = "/auth/login";
      break;

    case "/auth/update-password":
      CardTitle = "Set New Password";
      showDiv = false;
      BackPath = "/auth/login"
      break;

    case "/auth/callback":
      CardTitle = "Logging You In";
      showDiv = false;
      BackPath = "/auth/login";
      break;

    default:
      CardTitle = "Authentication";
      showDiv = true;
      BackPath = "/";
  }


  const { isLarge, isMedium, isSmall } = useResponsive();

  type Layout = {
    gridTemplateColumns: string;
    LeftArea: string;
    RightArea: string;
  };

  const getLayout = (): Layout => {
    if (isLarge) {
      return {
        gridTemplateColumns: "repeat(2, 1fr)",
        LeftArea: "1 / 1 / 2 / 2",
        RightArea: "1 / 2 / 2 / 3",
      };
    }

    return {
      gridTemplateColumns: "1fr",
      LeftArea: "1 / 1 / 2 / 2",
      RightArea: "1 / 1 / 2 / 2",
    };
  };

  const layout = getLayout();


  return (

    <div
      style={{
        overflowY: "clip",
        backgroundColor: "var(--bg-color)",
        display: "grid",
        gridTemplateColumns: layout.gridTemplateColumns,
        gridTemplateRows: "1fr auto",
        gridColumnGap: "0px",
        gridRowGap: "0px",
        width: "100%",
        minHeight: "100vh",
      }}
    >

      <div
        style={{
          width: "100%",
          height: "100%",
          gridArea: layout.RightArea,
          background:
            "radial-gradient(circle at center, var(--phase5-color) -10%, rgba(0,0,0,0) 65%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: "10vh",
        }}
      >


        {/* careeri CS */}
        <div
          style={{
            width: "50%",
            maxWidth: "320px",
            height: "fit-content",
          }}
        >
          <svg preserveAspectRatio="none" viewBox="0 0 983 169" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M37.5977 164.355C12.5326 164.355 0 151.823 0 126.758V39.7461C0 14.681 12.5326 2.14844 37.5977 2.14844H70.8984C95.9635 2.14844 108.496 14.681 108.496 39.7461V51.5625L88.0859 61.2305H87.0117V39.7461C87.0117 27.5716 81.6406 21.4844 70.8984 21.4844H37.5977C26.8555 21.4844 21.4844 27.5716 21.4844 39.7461V126.758C21.4844 138.932 26.8555 145.02 37.5977 145.02H70.8984C81.6406 145.02 87.0117 138.932 87.0117 126.758V114.941L107.422 105.273H108.496V126.758C108.496 151.823 95.9635 164.355 70.8984 164.355H37.5977ZM172.949 145.02H195.508C202.669 145.02 206.25 140.723 206.25 132.129V117.412C206.25 108.818 202.669 104.521 195.508 104.521H172.949C165.788 104.521 162.207 108.818 162.207 117.412V132.129C162.207 140.723 165.788 145.02 172.949 145.02ZM172.949 164.355C151.465 164.355 140.723 153.613 140.723 132.129V117.412C140.723 95.9277 151.465 85.1855 172.949 85.1855H195.508C199.232 85.1855 202.812 86.2598 206.25 88.4082V78.418C206.25 69.8242 202.669 65.5273 195.508 65.5273H157.051V64.4531L165.645 46.1914H195.508C216.992 46.1914 227.734 56.9336 227.734 78.418V158.984L207.324 168.652H206.25V161.133C203.529 163.281 199.948 164.355 195.508 164.355H172.949ZM259.961 168.652V78.418C259.961 56.9336 270.703 46.1914 292.188 46.1914H319.043V47.2656L310.449 65.5273H292.188C285.026 65.5273 281.445 69.8242 281.445 78.418V158.984L261.035 168.652H259.961ZM369.531 164.355C348.047 164.355 337.305 153.613 337.305 132.129V78.418C337.305 56.9336 348.047 46.1914 369.531 46.1914H394.238C415.723 46.1914 426.465 56.9336 426.465 78.418V84.1113L359.111 136.211C360.114 142.083 363.587 145.02 369.531 145.02H394.238C401.4 145.02 404.98 140.723 404.98 132.129V126.436L425.391 116.768H426.465V132.129C426.465 153.613 415.723 164.355 394.238 164.355H369.531ZM358.789 113.76L404.873 76.5918C404.443 69.2155 400.898 65.5273 394.238 65.5273H369.531C362.37 65.5273 358.789 69.8242 358.789 78.418V113.76ZM490.918 164.355C469.434 164.355 458.691 153.613 458.691 132.129V78.418C458.691 56.9336 469.434 46.1914 490.918 46.1914H515.625C537.109 46.1914 547.852 56.9336 547.852 78.418V84.1113L480.498 136.211C481.501 142.083 484.974 145.02 490.918 145.02H515.625C522.786 145.02 526.367 140.723 526.367 132.129V126.436L546.777 116.768H547.852V132.129C547.852 153.613 537.109 164.355 515.625 164.355H490.918ZM480.176 113.76L526.26 76.5918C525.83 69.2155 522.285 65.5273 515.625 65.5273H490.918C483.757 65.5273 480.176 69.8242 480.176 78.418V113.76ZM580.078 168.652V78.418C580.078 56.9336 590.82 46.1914 612.305 46.1914H639.16V47.2656L630.566 65.5273H612.305C605.143 65.5273 601.562 69.8242 601.562 78.418V158.984L581.152 168.652H580.078ZM664.404 22.4512C661.898 19.873 660.645 16.7936 660.645 13.2129C660.645 9.56055 661.898 6.44531 664.404 3.86719C666.911 1.28906 669.954 0 673.535 0C677.116 0 680.16 1.28906 682.666 3.86719C685.173 6.44531 686.426 9.56055 686.426 13.2129C686.426 16.7936 685.173 19.873 682.666 22.4512C680.16 25.0293 677.116 26.3184 673.535 26.3184C669.954 26.3184 666.911 25.0293 664.404 22.4512ZM662.793 168.652V51.5625L683.203 41.8945H684.277V158.984L663.867 168.652H662.793ZM764.844 164.355C739.779 164.355 727.246 151.823 727.246 126.758V39.7461C727.246 14.681 739.779 2.14844 764.844 2.14844H798.145C823.21 2.14844 835.742 14.681 835.742 39.7461V51.5625L815.332 61.2305H814.258V39.7461C814.258 27.5716 808.887 21.4844 798.145 21.4844H764.844C754.102 21.4844 748.73 27.5716 748.73 39.7461V126.758C748.73 138.932 754.102 145.02 764.844 145.02H798.145C808.887 145.02 814.258 138.932 814.258 126.758V114.941L834.668 105.273H835.742V126.758C835.742 151.823 823.21 164.355 798.145 164.355H764.844ZM912.012 164.355C886.947 164.355 874.414 151.823 874.414 126.758V114.941L894.824 105.273H895.898V126.758C895.898 138.932 901.27 145.02 912.012 145.02H945.312C956.055 145.02 961.426 138.932 961.426 126.758V104.199C961.426 92.0247 956.055 85.9375 945.312 85.9375H916.309C894.824 85.9375 884.082 75.1953 884.082 53.7109V34.375C884.082 12.8906 894.824 2.14844 916.309 2.14844H941.016C962.5 2.14844 973.242 12.8906 973.242 34.375V40.0684L952.832 49.7363H951.758V34.375C951.758 25.7812 948.177 21.4844 941.016 21.4844H916.309C909.147 21.4844 905.566 25.7812 905.566 34.375V53.7109C905.566 62.3047 909.147 66.6016 916.309 66.6016H945.312C970.378 66.6016 982.91 79.1341 982.91 104.199V126.758C982.91 151.823 970.378 164.355 945.312 164.355H912.012Z" fill="url(#paint0_radial_1277_259)" />
            <defs>
              <radialGradient id="paint0_radial_1277_259" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(489.307 85.8555) scale(620.5 132.5)">
                <stop stopColor="white" />
                <stop offset="1" stopColor="#999999" />
              </radialGradient>
            </defs>
          </svg>

        </div>

        {
          !isLarge &&

          <div
            style={{
              width: "100%",
              height: isLarge?"100vh":"100%",
              gridArea: layout.LeftArea,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              boxSizing: "border-box",
              zIndex: 999,
            }}
          >
            <div
              style={{
                backgroundColor: "var(--form-grey)",
                borderRadius: "var(--radius-xl)",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingInline: "var(--space-2xl)",
                paddingBlock: "var(--space-xl)",
                textAlign: "center",
                boxSizing: "border-box",
              }}
            >
              <h1
                style={{
                  color: "#fff",
                  fontSize: "var(--text-xl)",
                }}
              >
                {CardTitle}
              </h1>

              {children}

              {showDiv && (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#fff",
                      width: "100%",
                      height: "0.1rem",
                    }}
                  />

                  <Button
                    variant="text"
                    textContent={{
                      before: Message ?? "",
                      buttonText: LinkText ?? "",
                    }}
                    onClick={() => router.push(Link ?? "/")}
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => router.push(BackPath ?? "/")}
              style={{
                position: "absolute",
                top: "clamp(0.75rem, 2vw, 1.25rem)",
                left: "clamp(0.75rem, 2vw, 1.25rem)",
                width: "clamp(2.5rem, 6vw, 4rem)",
                height: "clamp(2.5rem, 6vw, 4rem)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                preserveAspectRatio="none"
                viewBox="0 0 78 78"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <path
                  d="M34.8494 38.6795L49.5309 53.5142L45.016 57.9825L25.8662 38.6328L45.2159 19.483L49.6842 23.998L34.8494 38.6795Z"
                  fill="#E6E0E9"
                />
              </svg>
            </button>
          </div>

        }

        {/* robot */}
        {isLarge &&
          <div
            style={{
              height: "fit-content",
              maxWidth: isMedium ? "50%" : "70%",
            }}
          >
            <img
              src="/landing/robot.svg"
              alt="Our Robot"
              style={{ width: "100%", display: "block" }}
            />
          </div>
        }
      </div>

      {isLarge &&
        <div
          style={{
            width: "100%",
            height: "100vh",
            gridArea: layout.LeftArea,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            boxSizing: "border-box",
            zIndex: 999,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--form-grey)",
              borderRadius: "var(--radius-xl)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingInline: "var(--space-2xl)",
              paddingBlock: "var(--space-xl)",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <h1
              style={{
                color: "#fff",
                fontSize: "var(--text-xl)",
              }}
            >
              {CardTitle}
            </h1>

            {children}

            {showDiv && (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#fff",
                    width: "100%",
                    height: "0.1rem",
                  }}
                />

                <Button
                  variant="text"
                  textContent={{
                    before: Message ?? "",
                    buttonText: LinkText ?? "",
                  }}
                  onClick={() => router.push(Link ?? "/")}
                />
              </div>
            )}
          </div>

          <button
            onClick={() => router.push(BackPath ?? "/")}
            style={{
              position: "absolute",
              top: "clamp(0.75rem, 2vw, 1.25rem)",
              left: "clamp(0.75rem, 2vw, 1.25rem)",
              width: "clamp(2.5rem, 6vw, 4rem)",
              height: "clamp(2.5rem, 6vw, 4rem)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              preserveAspectRatio="none"
              viewBox="0 0 78 78"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              <path
                d="M34.8494 38.6795L49.5309 53.5142L45.016 57.9825L25.8662 38.6328L45.2159 19.483L49.6842 23.998L34.8494 38.6795Z"
                fill="#E6E0E9"
              />
            </svg>
          </button>
        </div>
      }
    </div >
  );
}
