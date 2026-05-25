"use client";

import AddressField from "@/components/ui/Address Field";
import { Button } from "@/components/ui/button";
import InputField from "@/components/ui/input-field";
import AccountDeletePopup from "@/components/ui/account-delete-popup";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuth } from "@/providers/auth-provider";
import { profileService } from "@/services/profile.service";
import type { ApiResponse, UserProfile, UserProfileUpsertRequest } from "@/types";

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeOptionalEmail(value: string): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function buildFallbackFullName(displayName?: string | null, email?: string | null): string {
  const preferredName = displayName?.trim();
  if (preferredName) {
    return preferredName;
  }

  const emailPrefix = (email || "").split("@")[0]?.trim();
  if (emailPrefix) {
    return emailPrefix;
  }

  return "User";
}

function buildFallbackUsername(email?: string | null): string | null {
  const localPart = (email || "").split("@")[0]?.trim().toLowerCase();
  if (!localPart) {
    return null;
  }

  const sanitized = localPart
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || null;
}

function isProfileNotFoundResponse(response: ApiResponse<UserProfile>): boolean {
  if (response.errors?.some((error) => error.code === "HTTP_404")) {
    return true;
  }

  return /not found/i.test(response.message || "");
}

function isValidOptionalEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isValidOptionalHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Profile() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isLarge, isSmall } = useResponsive();

  const isGrid = isLarge;

  const [isEditingFields, setIsEditingFields] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeletePopupOpen, setIsDeletePopupOpen] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [github, setGithub] = useState("");

  const isMutatingProfile = isSavingProfile || isDeletingAccount;
  const canEditName = isEditingName && !isMutatingProfile && !isLoadingProfile;
  const canEditFields = isEditingFields && !isMutatingProfile && !isLoadingProfile;

  const applyProfileToForm = (profile: UserProfile) => {
    setFullName(profile.full_name || "");
    setEmail(profile.email || "");
    setPhone(profile.phone || "");
    setWorkEmail(profile.secondary_email || "");
    setCity(profile.city || "");
    setCountry(profile.country || "");
    setLinkedin(profile.linkedin || "");
    setPortfolio(profile.portfolio || "");
    setGithub(profile.github || "");
  };

  useEffect(() => {
    let alive = true;

    const loadProfile = async () => {
      if (isAuthLoading) {
        return;
      }

      if (!user?.id) {
        if (!alive) {
          return;
        }

        setIsLoadingProfile(false);
        setProfileError("Please sign in to access your profile.");
        return;
      }

      setIsLoadingProfile(true);
      setProfileError(null);
      setProfileSuccess(null);

      const response = await profileService.getUserProfile(user.id);
      if (!alive) {
        return;
      }

      if (response.success && response.data) {
        applyProfileToForm(response.data);
        setIsLoadingProfile(false);
        return;
      }

      if (!isProfileNotFoundResponse(response)) {
        setProfileError(response.message || "Unable to load your profile right now.");
        setIsLoadingProfile(false);
        return;
      }

      const fallbackFullName = buildFallbackFullName(user.displayName, user.email);
      const createPayload: UserProfileUpsertRequest = {
        full_name: fallbackFullName,
        email: normalizeOptionalEmail(user.email || "") || null,
        username: buildFallbackUsername(user.email || "") || null,
        auth_display_name: user.displayName || null,
      };

      const createResponse = await profileService.upsertUserProfile(user.id, createPayload);
      if (!alive) {
        return;
      }

      if (createResponse.success && createResponse.data) {
        applyProfileToForm(createResponse.data);
      } else {
        setProfileError(createResponse.message || "Unable to initialize your profile.");
      }

      setIsLoadingProfile(false);
    };

    void loadProfile();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, user?.displayName, user?.email, user?.id]);

  async function saveProfile(): Promise<boolean> {
    if (!user?.id) {
      setProfileError("Please sign in first to save your profile.");
      return false;
    }

    const normalizedFullName = normalizeOptionalText(fullName);
    if (!normalizedFullName) {
      setProfileError("Full name is required.");
      return false;
    }

    if (!isValidOptionalEmail(email)) {
      setProfileError("Please enter a valid personal email.");
      return false;
    }

    if (!isValidOptionalEmail(workEmail)) {
      setProfileError("Please enter a valid work email.");
      return false;
    }

    if (!isValidOptionalHttpUrl(linkedin)) {
      setProfileError("LinkedIn URL must start with http:// or https://");
      return false;
    }

    if (!isValidOptionalHttpUrl(portfolio)) {
      setProfileError("Portfolio URL must start with http:// or https://");
      return false;
    }

    if (!isValidOptionalHttpUrl(github)) {
      setProfileError("GitHub URL must start with http:// or https://");
      return false;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    const payload: UserProfileUpsertRequest = {
      full_name: normalizedFullName,
      email: normalizeOptionalEmail(email),
      secondary_email: normalizeOptionalEmail(workEmail),
      phone: normalizeOptionalText(phone),
      city: normalizeOptionalText(city),
      country: normalizeOptionalText(country),
      linkedin: normalizeOptionalText(linkedin),
      portfolio: normalizeOptionalText(portfolio),
      github: normalizeOptionalText(github),
      auth_display_name: user.displayName || null,
    };

    const response = await profileService.upsertUserProfile(user.id, payload);
    setIsSavingProfile(false);

    if (!response.success || !response.data) {
      setProfileError(response.message || "Failed to save your profile.");
      return false;
    }

    applyProfileToForm(response.data);
    setProfileSuccess("Profile saved successfully.");
    return true;
  }

  async function handleNameEditAction() {
    if (isMutatingProfile || isLoadingProfile) {
      return;
    }

    if (!isEditingName) {
      setProfileError(null);
      setProfileSuccess(null);
      setIsEditingName(true);
      return;
    }

    const saved = await saveProfile();
    if (saved) {
      setIsEditingName(false);
    }
  }

  async function handleFieldsEditAction() {
    if (isMutatingProfile || isLoadingProfile) {
      return;
    }

    if (!isEditingFields) {
      setProfileError(null);
      setProfileSuccess(null);
      setIsEditingFields(true);
      return;
    }

    const saved = await saveProfile();
    if (saved) {
      setIsEditingFields(false);
    }
  }

  async function handleSwitchAccount() {
    try {
      await authService.signOut();
      router.push("/auth/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to switch account right now.";
      setProfileError(message);
    }
  }

  async function handleLogout() {
    try {
      await authService.signOut();
      router.push("/auth/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to logout right now.";
      setProfileError(message);
    }
  }

  function openDeletePopup() {
    if (isMutatingProfile || isLoadingProfile) {
      return;
    }

    setProfileError(null);
    setProfileSuccess(null);
    setIsDeletePopupOpen(true);
  }

  function closeDeletePopup() {
    if (isDeletingAccount) {
      return;
    }
    setIsDeletePopupOpen(false);
  }

  async function confirmDeleteAccount() {
    if (isMutatingProfile || isLoadingProfile) {
      return;
    }

    setIsDeletingAccount(true);
    setIsDeletePopupOpen(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      await authService.deleteAccount();
      // Account is deleted server-side; clear local auth state best-effort.
      await authService.signOut().catch(() => undefined);
      router.replace("/auth/login");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete account right now.";
      setProfileError(message);
      setIsDeletePopupOpen(false);
    } finally {
      setIsDeletingAccount(false);
    }
  }

  if (isAuthLoading || isLoadingProfile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "var(--font-nova-square)",
          backgroundColor: "var(--bg-color)",
        }}
      >
        Loading your profile...
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "var(--space-md)",
          color: "white",
          fontFamily: "var(--font-nova-square)",
          backgroundColor: "var(--bg-color)",
          padding: "var(--space-xl)",
        }}
      >
        <p style={{ margin: 0, textAlign: "center" }}>
          Please sign in to access your profile.
        </p>
        <Button onClick={() => router.push("/auth/login")}>Go to Login</Button>
      </div>
    );
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
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: isSmall ? "row" : "column",
        }}
      >
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
            alt="Back"
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
                  alt="Profile"
                  style={{
                    borderRadius: "999px",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />

                <img
                  src={isEditingPhoto ? "/profile/save.svg" : "/profile/edit.svg"}
                  alt="Edit photo"
                  style={{
                    width: "var(--icon-md)",
                    height: "var(--icon-md)",
                    cursor: "pointer",
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                  }}
                  onClick={() => setIsEditingPhoto((previous) => !previous)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                  width: isSmall ? "100%" : "50%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-md)",
                    width: "100%",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {canEditName ? (
                      <input
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
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
                        {fullName || "Your name"}
                      </h3>
                    )}
                  </div>

                  <img
                    src={isEditingName ? "/profile/save.svg" : "/profile/edit.svg"}
                    alt={isEditingName ? "Save profile name" : "Edit profile name"}
                    style={{
                      width: "var(--icon-md)",
                      cursor: isMutatingProfile ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      opacity: isMutatingProfile ? 0.6 : 1,
                    }}
                    onClick={() => {
                      void handleNameEditAction();
                    }}
                  />
                </div>

                {canEditName ? (
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                    {email || "No email set"}
                  </h3>
                )}
              </div>
            </div>

            <h3
              style={{
                color: "var(--bg-grey)",
                cursor: "pointer",
                marginLeft: "auto",
                whiteSpace: "nowrap",
              }}
              onClick={() => router.push("/auth/reset-password")}
            >
              Reset Password
            </h3>
          </div>

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
                onChange={(event) => setPhone(event.target.value)}
                disabled={!canEditFields}
              />

              <img
                src={isEditingFields ? "/profile/save.svg" : "/profile/edit.svg"}
                alt={isEditingFields ? "Save profile details" : "Edit profile details"}
                style={{
                  width: "var(--icon-md)",
                  cursor: isMutatingProfile ? "not-allowed" : "pointer",
                  opacity: isMutatingProfile ? 0.6 : 1,
                }}
                onClick={() => {
                  void handleFieldsEditAction();
                }}
              />
            </div>

            <AddressField
              label="Address"
              layout="row"
              disabled={!canEditFields}
              city={city}
              country={country}
              onCityChange={setCity}
              onCountryChange={(nextCountry) => setCountry(nextCountry)}
            />

            <InputField
              id="workEmail"
              label="Work Email"
              layout="row"
              value={workEmail}
              placeholder="example@company.com"
              onChange={(event) => setWorkEmail(event.target.value)}
              disabled={!canEditFields}
            />

            <InputField
              id="linkedin"
              label="LinkedIn"
              layout="row"
              value={linkedin}
              placeholder="https://linkedin.com/in/username"
              onChange={(event) => setLinkedin(event.target.value)}
              disabled={!canEditFields}
            />

            <InputField
              id="portfolio"
              label="Portfolio"
              layout="row"
              value={portfolio}
              placeholder="https://yourportfolio.com"
              onChange={(event) => setPortfolio(event.target.value)}
              disabled={!canEditFields}
            />

            <InputField
              id="github"
              label="GitHub"
              layout="row"
              value={github}
              placeholder="https://github.com/username"
              onChange={(event) => setGithub(event.target.value)}
              disabled={!canEditFields}
            />
          </div>

          {(profileError || profileSuccess) && (
            <p
              style={{
                margin: 0,
                color: profileError ? "var(--light-red)" : "var(--light-green)",
                fontFamily: "var(--font-nova-square)",
              }}
            >
              {profileError || profileSuccess}
            </p>
          )}

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
              onClick={() => {
                void handleSwitchAccount();
              }}
              disabled={isMutatingProfile}
            >
              Switch Account
            </Button>

            <Button
              variant="secondary-inverted"
              size="md"
              style={{
                flex: isSmall ? "1 1 calc(50% - var(--space-lg))" : 1,
              }}
              onClick={() => {
                void handleLogout();
              }}
              disabled={isMutatingProfile}
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
              onClick={() => {
                openDeletePopup();
              }}
              disabled={isMutatingProfile}
              isLoading={isDeletingAccount}
            >
              Delete Account
            </Button>
          </div>

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

      {isDeletePopupOpen && (
        <AccountDeletePopup
          isLoading={isDeletingAccount}
          onCancel={closeDeletePopup}
          onConfirm={() => {
            void confirmDeleteAccount();
          }}
        />
      )}
    </div>
  );
}
