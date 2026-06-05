"use client";

import AddressField from "@/components/ui/Address Field";
import { Button } from "@/components/ui/button";
import InputField from "@/components/ui/input-field";
import AccountDeletePopup from "@/components/ui/account-delete-popup";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authService } from "@/services/auth.service";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuth } from "@/providers/auth-provider";
import { profileService } from "@/services/profile.service";
import { supabase } from "@/lib/supabase";
import type { ApiResponse, UserProfile, UserProfileUpsertRequest } from "@/types";

const PROFILE_PHOTO_BUCKET = "profile-pictures";
const MAX_PROFILE_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const PROFILE_PHOTO_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

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

function sanitizeProfilePhotoFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized || "profile-photo";
}

async function getProfilePhotoUrlFromPath(path: string): Promise<string | null> {
  if (!path) {
    return null;
  }

  const signedUrlResponse = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .createSignedUrl(path, PROFILE_PHOTO_SIGNED_URL_TTL_SECONDS);

  if (!signedUrlResponse.error && signedUrlResponse.data?.signedUrl) {
    return signedUrlResponse.data.signedUrl;
  }

  const publicUrl = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  return publicUrl || null;
}

async function resolveProfilePhotoFromAuthMetadata(fallbackAvatarUrl?: string): Promise<string | null> {
  const userResponse = await supabase.auth.getUser();
  const metadata = userResponse.data.user?.user_metadata;

  const avatarPath = typeof metadata?.avatar_path === "string" ? metadata.avatar_path : "";
  if (avatarPath) {
    const resolvedFromPath = await getProfilePhotoUrlFromPath(avatarPath);
    if (resolvedFromPath) {
      return resolvedFromPath;
    }
  }

  const avatarUrl = typeof metadata?.avatar_url === "string" ? metadata.avatar_url : "";
  return avatarUrl || fallbackAvatarUrl || null;
}

export default function Profile() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isLarge, isSmall } = useResponsive();
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const profileSnapshotRef = useRef({
    fullName: "",
    phone: null as string | null,
    workEmail: null as string | null,
    city: null as string | null,
    country: null as string | null,
    linkedin: null as string | null,
    portfolio: null as string | null,
    github: null as string | null,
  });

  const isGrid = isLarge;

  const [isEditingFields, setIsEditingFields] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [persistedAvatarUrl, setPersistedAvatarUrl] = useState("");

  const isMutatingProfile = isSavingProfile || isDeletingAccount || isUploadingPhoto;
  const canEditName = isEditingName && !isMutatingProfile && !isLoadingProfile;
  const canEditFields = isEditingFields && !isMutatingProfile && !isLoadingProfile;
  const displayedAvatarUrl = avatarPreviewUrl || persistedAvatarUrl || user?.avatarUrl || "/sidebar/profile.svg";

  const applyProfileToForm = (profile: UserProfile, nextAvatarUrl?: string | null) => {
    setFullName(profile.full_name || "");
    setEmail(profile.email || "");
    setPhone(profile.phone || "");
    setWorkEmail(profile.secondary_email || "");
    setCity(profile.city || "");
    setCountry(profile.country || "");
    setLinkedin(profile.linkedin || "");
    setPortfolio(profile.portfolio || "");
    setGithub(profile.github || "");

    profileSnapshotRef.current = {
      fullName: normalizeOptionalText(profile.full_name || "") || "",
      phone: normalizeOptionalText(profile.phone || ""),
      workEmail: normalizeOptionalEmail(profile.secondary_email || ""),
      city: normalizeOptionalText(profile.city || ""),
      country: normalizeOptionalText(profile.country || ""),
      linkedin: normalizeOptionalText(profile.linkedin || ""),
      portfolio: normalizeOptionalText(profile.portfolio || ""),
      github: normalizeOptionalText(profile.github || ""),
    };

    if (typeof nextAvatarUrl !== "undefined") {
      setPersistedAvatarUrl(nextAvatarUrl || "");
    }
  };

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

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

      const [response, resolvedAvatarUrl] = await Promise.all([
        profileService.getUserProfile(user.id),
        resolveProfilePhotoFromAuthMetadata(user.avatarUrl),
      ]);
      if (!alive) {
        return;
      }

      if (response.success && response.data) {
        applyProfileToForm(response.data, resolvedAvatarUrl || null);
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
        applyProfileToForm(createResponse.data, resolvedAvatarUrl || null);
      } else {
        setProfileError(createResponse.message || "Unable to initialize your profile.");
      }

      setIsLoadingProfile(false);
    };

    void loadProfile();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, user?.avatarUrl, user?.displayName, user?.email, user?.id]);

  async function saveNameProfile(): Promise<boolean> {
    if (!user?.id) {
      setProfileError("Please sign in first to save your profile.");
      return false;
    }

    const normalizedFullName = normalizeOptionalText(fullName);
    if (!normalizedFullName) {
      setProfileError("Full name is required.");
      return false;
    }

    if (normalizedFullName === profileSnapshotRef.current.fullName) {
      setProfileSuccess("No changes to save.");
      return true;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    const payload: UserProfileUpsertRequest = {
      full_name: normalizedFullName,
      auth_display_name: user.displayName || null,
    };

    const response = await profileService.updateUserProfile(user.id, payload);
    setIsSavingProfile(false);

    if (!response.success || !response.data) {
      setProfileError(response.message || "Failed to save your profile.");
      return false;
    }

    applyProfileToForm(response.data);
    setProfileSuccess("Name saved successfully.");
    return true;
  }

  async function saveDetailsProfile(): Promise<boolean> {
    if (!user?.id) {
      setProfileError("Please sign in first to save your profile.");
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

    const payload: UserProfileUpsertRequest = {};
    const normalizedPhone = normalizeOptionalText(phone);
    const normalizedWorkEmail = normalizeOptionalEmail(workEmail);
    const normalizedCity = normalizeOptionalText(city);
    const normalizedCountry = normalizeOptionalText(country);
    const normalizedLinkedin = normalizeOptionalText(linkedin);
    const normalizedPortfolio = normalizeOptionalText(portfolio);
    const normalizedGithub = normalizeOptionalText(github);

    if (normalizedPhone !== profileSnapshotRef.current.phone) {
      payload.phone = normalizedPhone;
    }

    if (normalizedWorkEmail !== profileSnapshotRef.current.workEmail) {
      payload.secondary_email = normalizedWorkEmail;
    }

    if (normalizedCity !== profileSnapshotRef.current.city) {
      payload.city = normalizedCity;
    }

    if (normalizedCountry !== profileSnapshotRef.current.country) {
      payload.country = normalizedCountry;
    }

    if (normalizedLinkedin !== profileSnapshotRef.current.linkedin) {
      payload.linkedin = normalizedLinkedin;
    }

    if (normalizedPortfolio !== profileSnapshotRef.current.portfolio) {
      payload.portfolio = normalizedPortfolio;
    }

    if (normalizedGithub !== profileSnapshotRef.current.github) {
      payload.github = normalizedGithub;
    }

    if (Object.keys(payload).length === 0) {
      setProfileSuccess("No changes to save.");
      return true;
    }

    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    const response = await profileService.updateUserProfile(user.id, payload);
    setIsSavingProfile(false);

    if (!response.success || !response.data) {
      setProfileError(response.message || "Failed to save your profile details.");
      return false;
    }

    applyProfileToForm(response.data);
    setProfileSuccess("Profile details saved successfully.");
    return true;
  }

  async function handleProfilePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user?.id) {
      return;
    }

    if (!PROFILE_PHOTO_ALLOWED_TYPES.has(file.type)) {
      setProfileError("Please upload a PNG, JPG, WebP, or GIF image.");
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE_BYTES) {
      setProfileError("Profile photo must be 5MB or smaller.");
      return;
    }

    const previousAvatarUrl = persistedAvatarUrl || user.avatarUrl || "";
    const previewUrl = URL.createObjectURL(file);

    setProfileError(null);
    setProfileSuccess(null);
    setAvatarPreviewUrl(previewUrl);
    setIsEditingPhoto(true);
    setIsUploadingPhoto(true);

    try {
      const safeFileName = sanitizeProfilePhotoFileName(file.name);
      const uploadPath = `${user.id}/${Date.now()}-${safeFileName}`;

      const uploadResponse = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(uploadPath, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

      if (uploadResponse.error) {
        throw uploadResponse.error;
      }

      const resolvedAvatarUrl = await getProfilePhotoUrlFromPath(uploadResponse.data.path);
      const metadataResponse = await supabase.auth.updateUser({
        data: {
          avatar_path: uploadResponse.data.path,
          avatar_url: resolvedAvatarUrl,
        },
      });

      if (metadataResponse.error) {
        throw metadataResponse.error;
      }

      setPersistedAvatarUrl(resolvedAvatarUrl || "");
      setAvatarPreviewUrl("");
      setProfileSuccess("Profile photo updated successfully.");
    } catch (error) {
      setPersistedAvatarUrl(previousAvatarUrl);
      setAvatarPreviewUrl("");
      setProfileError(error instanceof Error ? error.message : "Unable to update your profile photo right now.");
    } finally {
      setIsUploadingPhoto(false);
      setIsEditingPhoto(false);
    }
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

    const saved = await saveNameProfile();
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

    const saved = await saveDetailsProfile();
    if (saved) {
      setIsEditingFields(false);
    }
  }

  function handleProfilePhotoIconClick() {
    if (isMutatingProfile || isLoadingProfile) {
      return;
    }

    profilePhotoInputRef.current?.click();
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
                  src={displayedAvatarUrl}
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
                    cursor: isMutatingProfile ? "not-allowed" : "pointer",
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    opacity: isMutatingProfile ? 0.6 : 1,
                  }}
                  onClick={handleProfilePhotoIconClick}
                />

                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    void handleProfilePhotoChange(event);
                  }}
                  style={{ display: "none" }}
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

                <h3
                  style={{
                    fontSize: isLarge ? "var(--text-base)" : "var(--text-lg)",
                    margin: 0,
                    color: "var(--bg-grey)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {email || "No email set"}
                </h3>
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
