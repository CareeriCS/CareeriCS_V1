"use client";

import AddressField from "@/components/ui/Address Field";
import { Button } from "@/components/ui/button";
import InputField from "@/components/ui/input-field";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authService } from "@/services/auth.service";
import { useResponsive } from "@/hooks/useResponsive";

export default function Profile() {
  const router = useRouter();
  const { isLarge, isSmall, isMedium } = useResponsive();

  const isGrid = isLarge;

  // EDIT STATES
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);

  // PROFILE DATA (controlled)
  const [fullName, setFullName] = useState("Muhammad Tareq");
  const [email, setEmail] = useState("muhammadaboulgoukh@gmail.com");

  const [phone, setPhone] = useState("0123456789");
  const [workEmail, setWorkEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [github, setGithub] = useState("");

  async function handleLogout() {
    try {
      await authService.signOut();
      router.push("/auth/login");
    } catch (err: any) {
      console.error("Logout failed:", err.message);
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        maxHeight: "100%",
        backgroundColor: "var(--bg-color)",
        display: isGrid ? "grid" : "flex",
        flexDirection: isGrid ? undefined : "column",
        gridTemplateColumns: isGrid
          ? "minmax(0, 1.5fr) minmax(320px, 1fr)"
          : undefined,
        padding: "var(--space-md)",
        color: "white",
        overflow: "hidden",
      }}
    >
      {/* LEFT */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: isSmall ? "row" : "column",
        }}
      >
        {/* Back */}
        <div
          style={{
            position: "absolute",
            top: "var(--space-md)",
            left: "var(--space-md)",
            zIndex: 10,
          }}
        >
          <img
            src={"/auth/Back Arrow.svg"}
            style={{
              width: "var(--icon-md)",
              cursor: "pointer",
            }}
            onClick={() => router.back()}
          />
        </div>

        <div
          style={{
            width: "100%",
            height: "100%",
            paddingInline: "var(--space-2xl)",
            display: "flex",
            flexDirection: "column",
            justifyContent: !isSmall ? "center" : "flex-start",
            gap: "var(--space-xl)",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              display: "flex",
              flexDirection: isSmall ? "column-reverse" : "row",
              gap: "var(--space-md)",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "var(--space-md)",
                alignItems: "flex-start",
                flexDirection: isSmall ? "column" : "row",
                width: "100%",
                minWidth: 0,
              }}
            >
              {/* PROFILE ICON */}
              <div
                style={{
                  width: "var(--icon-3xl)",
                  height: "var(--icon-3xl)",
                  position: "relative",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <img
                  src={"/sidebar/profile.svg"}
                  style={{
                    borderRadius: "999px",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />

                <img
                  src={isEditingPhoto ? "/profile/save.svg" : "/profile/edit.svg"}
                  style={{
                    width: "var(--icon-md)",
                    height: "var(--icon-md)",
                    cursor: "pointer",
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                  }}
                  onClick={() => setIsEditingPhoto((p) => !p)}
                />
              </div>

              {/* NAME + EMAIL + EDIT */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                  width: isSmall?"100%":"50%",
                }}
              >
                {/* NAME ROW */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-md)",
                    width: "100%",
                  }}
                >
                  {/* NAME */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {isEditingName ? (
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={{
                          width: "100%",
                          backgroundColor: "transparent",
                          border: "1px solid var(--bg-grey)",
                          borderRadius: "var(--radius-md)",
                          padding: "var(--space-sm) var(--space-md)",
                          color: "white",
                          fontSize: "var(--text-base)",
                          outline: "none",
                          fontFamily: "var(--font-nova-square)",
                        }}
                      />
                    ) : (
                      <h3
                        style={{
                          fontSize: isLarge ? "var(--text-md)" : "var(--text-xl)",
                          margin: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {fullName}
                      </h3>
                    )}
                  </div>

                  {/* EDIT ICON */}
                  <img
                    src={isEditingName ? "/profile/save.svg" : "/profile/edit.svg"}
                    style={{
                      width: "var(--icon-md)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    onClick={() => setIsEditingName((p) => !p)}
                  />
                </div>

                {/* EMAIL */}
                {isEditingName ? (
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      backgroundColor: "transparent",
                      border: "1px solid var(--bg-grey)",
                      borderRadius: "var(--radius-md)",
                      padding: "var(--space-sm) var(--space-md)",
                      color: "white",
                      fontSize: "var(--text-base)",
                      outline: "none",
                      fontFamily: "var(--font-nova-square)",
                    }}
                  />
                ) : (
                  <h3
                    style={{
                      fontSize: isLarge ? "var(--text-base)" : "var(--text-lg)",
                      margin: 0,
                      color: "var(--bg-grey)",
                    }}
                  >
                    {email}
                  </h3>
                )}
              </div>
            </div>

            {/* RESET PASSWORD */}
            <h3
              style={{
                color: "var(--bg-grey)",
                cursor: "pointer",
                marginLeft: "auto",
                whiteSpace: "nowrap",
              }}
            >
              Reset Password
            </h3>
          </div>

          {/* FORM */}
          <div
            style={{
              width: "100%",
              backgroundColor: isEditingFields
                ? "var(--medium-blue)"
                : "var(--dark-blue)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-md)",
              color: "black",
            }}
          >
            {/* PHONE */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "var(--space-xl)",
              }}
            >
              <InputField
                id="phone"
                label="Phone No."
                layout="row"
                value={phone}
                placeholder="Enter your phone number"
                onChange={(e: any) => setPhone(e.target.value)}
                disabled={!isEditingFields}
              />

              <img
                src={isEditingFields ? "/profile/save.svg" : "/profile/edit.svg"}
                style={{ width: "var(--icon-md)", cursor: "pointer" }}
                onClick={() => setIsEditingFields((p) => !p)}
              />
            </div>

            <AddressField
              label="Address"
              layout="row"
              disabled={!isEditingFields}
            />

            <InputField
              id="workEmail"
              label="Work Email"
              layout="row"
              value={workEmail}
              placeholder="example@company.com"
              onChange={(e: any) => setWorkEmail(e.target.value)}
              disabled={!isEditingFields}
            />

            <InputField
              id="linkedin"
              label="LinkedIn"
              layout="row"
              value={linkedin}
              placeholder="https://linkedin.com/in/username"
              onChange={(e: any) => setLinkedin(e.target.value)}
              disabled={!isEditingFields}
            />

            <InputField
              id="portfolio"
              label="Portfolio"
              layout="row"
              value={portfolio}
              placeholder="https://yourportfolio.com"
              onChange={(e: any) => setPortfolio(e.target.value)}
              disabled={!isEditingFields}
            />

            <InputField
              id="github"
              label="GitHub"
              layout="row"
              value={github}
              placeholder="https://github.com/username"
              onChange={(e: any) => setGithub(e.target.value)}
              disabled={!isEditingFields}
            />
          </div>

          {/* BUTTONS */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--space-lg)",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="primary-inverted"
              size="md"
              style={{
                flex: isSmall ? "1 1 calc(50% - var(--space-lg))" : 1,
              }}
            >
              Switch Account
            </Button>

            <Button
              variant="secondary-inverted"
              size="md"
              style={{
                flex: isSmall ? "1 1 calc(50% - var(--space-lg))" : 1,
              }}
              onClick={handleLogout}
            >
              Logout
            </Button>

            <Button
              variant="danger"
              size="md"
              style={{
                width: isSmall ? "100%" : "auto",
                flex: isSmall ? "1 1 100%" : 1,
              }}
            >
              Delete Account
            </Button>
          </div>

          {/* CONTACT */}
          <h3 style={{ textAlign: "center" }}>
            Contact us at{" "}
            <a
              href="mailto:careeri.cs2026@gmail.com"
              style={{ textDecoration: "underline", color: "inherit" }}
            >
              careeri.cs2026@gmail.com
            </a>
          </h3>
        </div>
      </div>

      {/* RIGHT */}
      {isLarge && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            background:
              "radial-gradient(circle at center, var(--phase5-color) -10%, rgba(0,0,0,0) 65%)",
          }}
        >
          <img
            src="/landing/robot.svg"
            alt="robot"
            style={{ width: "80%", marginLeft: "auto", display: "block" }}
          />
        </div>
      )}
    </div>
  );
}