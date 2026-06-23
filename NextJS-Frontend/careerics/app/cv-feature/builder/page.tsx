"use client";

import React, { useEffect, useRef, useState } from "react";
import { Country, State } from "country-state-city";
import ISO6391 from "iso-639-1";
import Animation from "@/components/ui/animation";

import { useGoogleDriveUpload } from "@/hooks";
import {
  closeGoogleDriveWindow,
  navigateGoogleDriveWindow,
  openGoogleDriveLoadingWindow,
  renderGoogleDriveLoadingWindow,
} from "@/lib/google-drive-popup";
import { useAuth } from "@/providers/auth-provider";
import { cvService } from "@/services";
import type { CVProfile } from "@/types";
import { Button } from "@/components/ui/button";
import DynamicCVForm from "@/components/ui/cv-form";
import Interview from "@/components/ui/interview";
import InterviewCard from "@/components/ui/interview-card";
import { PdfPreviewFrame } from "@/components/ui/pdf-preview-frame";
import { useResponsive } from "@/hooks/useResponsive";

type MultiRow = { id: number };

type BuilderPrefillState = {
  formData: Record<string, string>;
  educationList: MultiRow[];
  langList: MultiRow[];
  skillList: MultiRow[];
  certList: MultiRow[];
  awardList: MultiRow[];
  experienceList: MultiRow[];
  projectList: MultiRow[];
  referenceList: MultiRow[];
};

let rowSequence = 0;

function createRowId(): number {
  rowSequence += 1;
  return Date.now() + rowSequence;
}

function createRow(): MultiRow {
  return { id: createRowId() };
}

function withFallbackRow(rows: MultiRow[]): MultiRow[] {
  return rows.length ? rows : [createRow()];
}

function splitTextLines(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n|,|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinTextLines(values?: string[] | null): string {
  return (values ?? []).filter(Boolean).join("\n");
}

function getFormValue(formData: Record<string, string>, key: string): string {
  return formData[key]?.trim() ?? "";
}

type ValidationErrors = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_ALLOWED_PATTERN = /^\+?[0-9\s().-]+$/;
const TEXT_NAME_PATTERN = /^[\p{L}\s.'-]+$/u;
const STEP_ONE_FIELD_IDS = new Set([
  "name",
  "job",
  "country",
  "city",
  "phone",
  "email",
  "port",
  "link",
  "sum",
]);
const STEP_FIELD_PREFIXES: Array<{ stepId: number; prefixes: string[] }> = [
  { stepId: 2, prefixes: ["inst-", "q-", "t-", "d-"] },
  { stepId: 3, prefixes: ["ln-", "lp-", "sn-", "sp-"] },
  { stepId: 4, prefixes: ["cname-", "corg-", "cdate-", "aname-", "aorg-", "adate-", "adesc-"] },
  { stepId: 5, prefixes: ["role-", "org-", "tp-", "resp-", "ach-"] },
  { stepId: 6, prefixes: ["pname-", "prole-", "ptech-", "pdesc-", "pach-"] },
  { stepId: 7, prefixes: ["rn-", "rr-", "ro-", "rc-"] },
];

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function isValidPhoneNumber(value: string): boolean {
  const trimmed = value.trim();
  const digitsCount = countDigits(trimmed);

  return (
    PHONE_ALLOWED_PATTERN.test(trimmed) &&
    digitsCount >= 10 &&
    digitsCount <= 15
  );
}

function isValidNameLikeText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && TEXT_NAME_PATTERN.test(trimmed);
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(normalizeUrl(value));
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

function isValidLinkedInUrl(value: string): boolean {
  try {
    const url = new URL(normalizeUrl(value));
    return url.hostname.toLowerCase().includes("linkedin.com");
  } catch {
    return false;
  }
}

function getStepIdForField(fieldId: string): number | null {
  if (!fieldId || fieldId === "_form") {
    return null;
  }

  if (STEP_ONE_FIELD_IDS.has(fieldId)) {
    return 1;
  }

  const match = STEP_FIELD_PREFIXES.find(({ prefixes }) =>
    prefixes.some((prefix) => fieldId.startsWith(prefix)),
  );

  return match?.stepId ?? null;
}

function getFirstActionableErrorFieldId(errors: ValidationErrors): string | null {
  return Object.keys(errors).find((fieldId) => fieldId !== "_form") ?? null;
}

function getValidationSummaryMessages(errors: ValidationErrors): string[] {
  return [...new Set(
    Object.entries(errors)
      .filter(([fieldId]) => fieldId !== "_form")
      .map(([, message]) => message),
  )];
}

function addValidationError(
  errors: ValidationErrors,
  fieldId: string,
  message: string,
): void {
  errors[fieldId] = message;
}

function validateRequiredText(
  errors: ValidationErrors,
  formData: Record<string, string>,
  fieldId: string,
  label: string,
): void {
  if (!getFormValue(formData, fieldId)) {
    addValidationError(errors, fieldId, `${label} is required.`);
  }
}

function validateOptionalNameLikeText(
  errors: ValidationErrors,
  formData: Record<string, string>,
  fieldId: string,
  label: string,
): void {
  const value = getFormValue(formData, fieldId);

  if (value && !isValidNameLikeText(value)) {
    addValidationError(
      errors,
      fieldId,
      `${label} should contain at least 2 letters and may include spaces, apostrophes, periods, or hyphens.`,
    );
  }
}

function validateOptionalUrl(
  errors: ValidationErrors,
  formData: Record<string, string>,
  fieldId: string,
  label: string,
): void {
  const value = getFormValue(formData, fieldId);

  if (value && !isValidUrl(value)) {
    addValidationError(errors, fieldId, `${label} should be a valid URL.`);
  }
}

function validateOptionalLinkedInUrl(
  errors: ValidationErrors,
  formData: Record<string, string>,
  fieldId: string,
  label: string,
): void {
  const value = getFormValue(formData, fieldId);

  if (value && !isValidLinkedInUrl(value)) {
    addValidationError(errors, fieldId, `${label} should be a valid LinkedIn URL.`);
  }
}

function toSafePdfFileName(label: string, fallback: string): string {
  const normalized = label
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");

  return `${normalized || fallback}.pdf`;
}

function buildPrefillState(profile: CVProfile): BuilderPrefillState {
  const formData: Record<string, string> = {
    name: profile.full_name ?? "",
    job: profile.professional_title ?? "",
    port: profile.portfolio ?? "",
    sum: profile.summary ?? "",
    country: profile.country ?? "",
    city: profile.city ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    link: profile.linkedin ?? "",
  };

  const educationList = withFallbackRow(
    profile.education.map((entry) => {
      const id = createRowId();
      formData[`inst-${id}`] = entry.institution ?? "";
      formData[`q-${id}`] = entry.qualification ?? "";
      formData[`t-${id}`] = entry.period ?? "";
      formData[`d-${id}`] = entry.details ?? "";
      return { id };
    }),
  );

  const langList = withFallbackRow(
    profile.languages.map((entry) => {
      const id = createRowId();
      formData[`ln-${id}`] = entry.language ?? "";
      formData[`lp-${id}`] = entry.proficiency ?? "";
      return { id };
    }),
  );

  const skillList = withFallbackRow(
    profile.skills
      .filter((entry) => entry.isCV && entry.skill?.skill_name)
      .map((entry) => {
        const id = createRowId();
        formData[`sn-${id}`] = entry.skill?.skill_name ?? "";
        formData[`sp-${id}`] = entry.proficiency ?? "";
        return { id };
      }),
  );

  const certList = withFallbackRow(
    profile.certifications.map((entry) => {
      const id = createRowId();
      formData[`cname-${id}`] = entry.title ?? "";
      formData[`corg-${id}`] = entry.organization ?? "";
      formData[`cdate-${id}`] = entry.period ?? "";
      return { id };
    }),
  );

  const awardList = withFallbackRow(
    profile.awards.map((entry) => {
      const id = createRowId();
      formData[`aname-${id}`] = entry.title ?? "";
      formData[`aorg-${id}`] = entry.organization ?? "";
      formData[`adate-${id}`] = entry.date ?? "";
      formData[`adesc-${id}`] = entry.description ?? "";
      return { id };
    }),
  );

  const experienceList = withFallbackRow(
    profile.experiences.map((entry) => {
      const id = createRowId();
      formData[`role-${id}`] = entry.role ?? "";
      formData[`org-${id}`] = entry.organization ?? "";
      formData[`tp-${id}`] = entry.period ?? "";
      formData[`resp-${id}`] = joinTextLines(entry.responsibilities);
      formData[`ach-${id}`] = entry.achievements ?? "";
      return { id };
    }),
  );

  const projectList = withFallbackRow(
    profile.projects.map((entry) => {
      const id = createRowId();
      formData[`pname-${id}`] = entry.title ?? "";
      formData[`prole-${id}`] = entry.role ?? "";
      formData[`ptech-${id}`] = joinTextLines(entry.technologies);
      formData[`pdesc-${id}`] = entry.description ?? "";
      formData[`pach-${id}`] = entry.achievements ?? "";
      return { id };
    }),
  );

  const referenceList = withFallbackRow(
    profile.references.map((entry) => {
      const id = createRowId();
      formData[`rn-${id}`] = entry.name ?? "";
      formData[`rr-${id}`] = entry.role ?? "";
      formData[`ro-${id}`] = entry.organization ?? "";
      formData[`rc-${id}`] = entry.contact_info ?? "";
      return { id };
    }),
  );

  return {
    formData,
    educationList,
    langList,
    skillList,
    certList,
    awardList,
    experienceList,
    projectList,
    referenceList,
  };
}

function profileHasStoredCvData(profile: CVProfile): boolean {
  return Boolean(
    profile.full_name ||
    profile.professional_title ||
    profile.summary ||
    profile.portfolio ||
    profile.country ||
    profile.city ||
    profile.phone ||
    profile.email ||
    profile.linkedin ||
    profile.skills.length ||
    profile.experiences.length ||
    profile.education.length ||
    profile.certifications.length ||
    profile.projects.length ||
    profile.languages.length ||
    profile.awards.length ||
    profile.references.length,
  );
}

function rowHasAnyValue(formData: Record<string, string>, fieldIds: string[]): boolean {
  return fieldIds.some((fieldId) => getFormValue(formData, fieldId) !== "");
}

function toBuilderPayload(
  formData: Record<string, string>,
  educationList: MultiRow[],
  langList: MultiRow[],
  skillList: MultiRow[],
  certList: MultiRow[],
  awardList: MultiRow[],
  experienceList: MultiRow[],
  projectList: MultiRow[],
  referenceList: MultiRow[],
): Record<string, unknown> {
  return {
    full_name: getFormValue(formData, "name"),
    professional_title: getFormValue(formData, "job"),
    portfolio: getFormValue(formData, "port"),
    summary: getFormValue(formData, "sum"),
    country: getFormValue(formData, "country"),
    city: getFormValue(formData, "city"),
    phone: getFormValue(formData, "phone"),
    email: getFormValue(formData, "email"),
    linkedin: getFormValue(formData, "link"),
    education: educationList
      .map((e) => ({
        institution: getFormValue(formData, `inst-${e.id}`),
        qualification: getFormValue(formData, `q-${e.id}`),
        period: getFormValue(formData, `t-${e.id}`),
        details: getFormValue(formData, `d-${e.id}`),
      }))
      .filter((i) => i.institution || i.qualification || i.period || i.details),
    languages: langList
      .map((e) => ({ language: getFormValue(formData, `ln-${e.id}`), proficiency: getFormValue(formData, `lp-${e.id}`) }))
      .filter((i) => i.language),
    skills: skillList
      .map((e) => ({ skill_name: getFormValue(formData, `sn-${e.id}`), proficiency: getFormValue(formData, `sp-${e.id}`) }))
      .filter((i) => i.skill_name),
    certifications: certList
      .map((entry) => ({
        title: getFormValue(formData, `cname-${entry.id}`),
        organization: getFormValue(formData, `corg-${entry.id}`),
        period: getFormValue(formData, `cdate-${entry.id}`),
      }))
      .filter((item) => item.title || item.organization || item.period),
    experiences: experienceList
      .map((e) => ({
        role: getFormValue(formData, `role-${e.id}`),
        organization: getFormValue(formData, `org-${e.id}`),
        period: getFormValue(formData, `tp-${e.id}`),
        responsibilities: splitTextLines(getFormValue(formData, `resp-${e.id}`)),
        achievements: getFormValue(formData, `ach-${e.id}`),
        technologies: splitTextLines(getFormValue(formData, `tech-${e.id}`)),
      }))
      .filter((i) => i.role),
    projects: projectList
      .map((entry) => ({
        title: getFormValue(formData, `pname-${entry.id}`),
        role: getFormValue(formData, `prole-${entry.id}`),
        technologies: splitTextLines(getFormValue(formData, `ptech-${entry.id}`)),
        description: getFormValue(formData, `pdesc-${entry.id}`),
        achievements: getFormValue(formData, `pach-${entry.id}`),
      }))
      .filter((item) => item.title || item.role || item.description),
    references: referenceList
      .map((e) => ({
        name: getFormValue(formData, `rn-${e.id}`),
        role: getFormValue(formData, `rr-${e.id}`),
        organization: getFormValue(formData, `ro-${e.id}`),
        contact_info: getFormValue(formData, `rc-${e.id}`),
      }))
      .filter((item) => item.name || item.role || item.organization || item.contact_info),
    awards: awardList
      .map((entry) => ({
        title: getFormValue(formData, `aname-${entry.id}`),
        organization: getFormValue(formData, `aorg-${entry.id}`),
        date: getFormValue(formData, `adate-${entry.id}`),
        description: getFormValue(formData, `adesc-${entry.id}`),
      }))
      .filter((item) => item.title || item.organization || item.date || item.description),
  };
}


export default function CVBuilderPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isMedium, isSmall } = useResponsive();

  const isCompactScreen = isSmall || isMedium;

  const [activeStepId, setActiveStepId] = useState(1);
  const [expandedStepId, setExpandedStepId] = useState<number>(1);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [buildError, setBuildError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [downloadName, setDownloadName] = useState("careerics_CV.pdf");
  const [isPrefillingProfile, setIsPrefillingProfile] = useState(false);
  const [pendingFocusFieldId, setPendingFocusFieldId] = useState<string | null>(null);

  const [educationList, setEducationList] = useState<MultiRow[]>(() => [createRow()]);
  const [langList, setLangList] = useState<MultiRow[]>(() => [createRow()]);
  const [skillList, setSkillList] = useState<MultiRow[]>(() => [createRow()]);
  const [certList, setCertList] = useState<MultiRow[]>(() => [createRow()]);
  const [awardList, setAwardList] = useState<MultiRow[]>(() => [createRow()]);
  const [experienceList, setExperienceList] = useState<MultiRow[]>(() => [createRow()]);
  const [projectList, setProjectList] = useState<MultiRow[]>(() => [createRow()]);
  const [referenceList, setReferenceList] = useState<MultiRow[]>(() => [createRow()]);
  const [sidebarExpandedId, setSidebarExpandedId] = useState(1);

  const hasUserEditedRef = useRef(false);
  const isHydratingProfileRef = useRef(false);
  const loadedProfileUserIdRef = useRef<string | null>(null);
  const {
    isUploading: isSavingToDrive,
    uploadError: driveUploadError,
    uploadedFile: uploadedDriveFile,
    ensureGoogleDriveAccess,
    resetUploadState,
    uploadToGoogleDrive,
  } = useGoogleDriveUpload();
  const driveOpenLink = uploadedDriveFile?.webViewLink ?? uploadedDriveFile?.webContentLink ?? null;

  const markFormDirty = () => {
    if (!isHydratingProfileRef.current) {
      hasUserEditedRef.current = true;
    }
  };

  const handleInputChange = (id: string, value: string) => {
    markFormDirty();
    setBuildError(null);

    const stepId = getStepIdForField(id);
    setFormData((previous) => {
      const nextFormData = { ...previous, [id]: value };

      setValidationErrors((previousErrors) => {
        if (!stepId) {
          if (!previousErrors[id]) return previousErrors;

          const nextErrors = { ...previousErrors };
          delete nextErrors[id];
          return nextErrors;
        }

        const hasStepErrors = Object.keys(previousErrors).some(
          (fieldId) => getStepIdForField(fieldId) === stepId,
        );

        if (!hasStepErrors) {
          return previousErrors;
        }

        const nextStepErrors = validateStep(stepId, nextFormData);
        const preservedErrors = Object.fromEntries(
          Object.entries(previousErrors).filter(
            ([fieldId]) => getStepIdForField(fieldId) !== stepId,
          ),
        );

        return { ...preservedErrors, ...nextStepErrors };
      });

      return nextFormData;
    });
  };

  const addEntry = (
    list: MultiRow[],
    setList: React.Dispatch<React.SetStateAction<MultiRow[]>>,
  ) => {
    markFormDirty();
    setBuildError(null);
    setList([...list, createRow()]);
  };

  const removeEntry = (
    id: number,
    list: MultiRow[],
    setList: React.Dispatch<React.SetStateAction<MultiRow[]>>,
  ) => {
    if (list.length <= 1) {
      return;
    }

    markFormDirty();
    setBuildError(null);
    setList(list.filter((item) => item.id !== id));
    setValidationErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([fieldId]) => !fieldId.endsWith(`-${id}`)),
      ),
    );
  };

  useEffect(() => {
    return () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); };
  }, [downloadUrl]);

  useEffect(() => {
    loadedProfileUserIdRef.current = null;
    hasUserEditedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    let alive = true;

    const loadSavedProfile = async () => {
      if (isAuthLoading || !user?.id || loadedProfileUserIdRef.current === user.id) {
        return;
      }

      loadedProfileUserIdRef.current = user.id;
      setIsPrefillingProfile(true);

      try {
        const response = await cvService.getProfile(user.id);
        if (!alive || !response.success || !response.data || hasUserEditedRef.current) {
          return;
        }

        if (!profileHasStoredCvData(response.data)) {
          return;
        }

        const nextState = buildPrefillState(response.data);
        isHydratingProfileRef.current = true;

        setFormData(nextState.formData);
        setEducationList(nextState.educationList);
        setLangList(nextState.langList);
        setSkillList(nextState.skillList);
        setCertList(nextState.certList);
        setAwardList(nextState.awardList);
        setExperienceList(nextState.experienceList);
        setProjectList(nextState.projectList);
        setReferenceList(nextState.referenceList);
      } finally {
        isHydratingProfileRef.current = false;
        if (alive) {
          setIsPrefillingProfile(false);
        }
      }
    };

    void loadSavedProfile();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, user?.id]);

  useEffect(() => {
    if (!pendingFocusFieldId || pendingFocusFieldId === "_form") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const target = document.getElementById(pendingFocusFieldId);

      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus();
      }

      setPendingFocusFieldId(null);
    }, 60);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [expandedStepId, pendingFocusFieldId]);

  const cvSteps = [
    { id: 1, title: "Personal Details", text: "Name, Job Title, Portfolio, Summary..." },
    { id: 2, title: "Education", text: "Institution, Qualification, Period, Details." },
    { id: 3, title: "Languages & Skills", text: "Highlight your key strengths" },
    { id: 4, title: "Certificates & Awards", text: "Title, Organization, Date, Description..." },
    { id: 5, title: "Experience", text: "Add your previous job roles" },
    { id: 6, title: "Projects", text: "Showcase your work" },
    { id: 7, title: "References", text: "Professional vouchers" },
  ];

  const validateStep = (
    stepId: number,
    values: Record<string, string> = formData,
  ): ValidationErrors => {
    const errors: ValidationErrors = {};

    switch (stepId) {
      case 1: {
        validateRequiredText(errors, values, "name", "Full Name");
        validateRequiredText(errors, values, "job", "Job Title");
        validateRequiredText(errors, values, "country", "Country");
        validateRequiredText(errors, values, "city", "City");
        validateRequiredText(errors, values, "phone", "Phone Number");
        validateRequiredText(errors, values, "email", "Email Address");

        validateOptionalNameLikeText(errors, values, "name", "Full Name");

        const phone = getFormValue(values, "phone");
        if (phone && !isValidPhoneNumber(phone)) {
          addValidationError(
            errors,
            "phone",
            "Phone Number should contain 10 to 15 digits and only valid phone characters.",
          );
        }

        const email = getFormValue(values, "email");
        if (email && !isValidEmail(email)) {
          addValidationError(errors, "email", "Email Address should be valid, for example name@example.com.");
        }

        validateOptionalUrl(errors, values, "port", "Portfolio");
        validateOptionalLinkedInUrl(errors, values, "link", "LinkedIn Profile");

        break;
      }

      case 2:
        educationList.forEach((entry, index) => {
          const visibleFields = [`inst-${entry.id}`, `q-${entry.id}`, `t-${entry.id}`];
          if (!rowHasAnyValue(values, visibleFields)) return;

          validateRequiredText(errors, values, `inst-${entry.id}`, `Education ${index + 1} institution`);
          validateRequiredText(errors, values, `q-${entry.id}`, `Education ${index + 1} qualification`);
          validateRequiredText(errors, values, `t-${entry.id}`, `Education ${index + 1} time period`);
        });
        break;

      case 3:
        langList.forEach((entry, index) => {
          const allFields = [`ln-${entry.id}`, `lp-${entry.id}`];
          if (!rowHasAnyValue(values, allFields)) return;

          validateRequiredText(errors, values, `ln-${entry.id}`, `Language ${index + 1}`);
          validateRequiredText(errors, values, `lp-${entry.id}`, `Language ${index + 1} proficiency`);
        });

        skillList.forEach((entry, index) => {
          const allFields = [`sn-${entry.id}`, `sp-${entry.id}`];
          if (!rowHasAnyValue(values, allFields)) return;

          validateRequiredText(errors, values, `sn-${entry.id}`, `Skill ${index + 1}`);
          validateRequiredText(errors, values, `sp-${entry.id}`, `Skill ${index + 1} level`);
        });
        break;

      case 4:
        certList.forEach((entry, index) => {
          const allFields = [`cname-${entry.id}`, `corg-${entry.id}`, `cdate-${entry.id}`];
          if (!rowHasAnyValue(values, allFields)) return;

          validateRequiredText(errors, values, `cname-${entry.id}`, `Certificate ${index + 1} title`);
          validateRequiredText(errors, values, `corg-${entry.id}`, `Certificate ${index + 1} organization`);
          validateRequiredText(errors, values, `cdate-${entry.id}`, `Certificate ${index + 1} date`);
        });

        awardList.forEach((entry, index) => {
          const visibleFields = [`aname-${entry.id}`, `aorg-${entry.id}`, `adate-${entry.id}`];
          if (!rowHasAnyValue(values, visibleFields)) return;

          validateRequiredText(errors, values, `aname-${entry.id}`, `Award ${index + 1} title`);
          validateRequiredText(errors, values, `aorg-${entry.id}`, `Award ${index + 1} organization`);
          validateRequiredText(errors, values, `adate-${entry.id}`, `Award ${index + 1} year`);
        });
        break;

      case 5:
        experienceList.forEach((entry, index) => {
          const visibleFields = [`role-${entry.id}`, `org-${entry.id}`, `tp-${entry.id}`, `resp-${entry.id}`];
          if (!rowHasAnyValue(values, visibleFields)) return;

          validateRequiredText(errors, values, `role-${entry.id}`, `Experience ${index + 1} role`);
          validateRequiredText(errors, values, `org-${entry.id}`, `Experience ${index + 1} organization`);
          validateRequiredText(errors, values, `tp-${entry.id}`, `Experience ${index + 1} time period`);
          validateRequiredText(errors, values, `resp-${entry.id}`, `Experience ${index + 1} responsibilities`);
        });
        break;

      case 6:
        projectList.forEach((entry, index) => {
          const allFields = [`pname-${entry.id}`, `prole-${entry.id}`, `ptech-${entry.id}`, `pdesc-${entry.id}`, `pach-${entry.id}`];
          if (!rowHasAnyValue(values, allFields)) return;

          validateRequiredText(errors, values, `pname-${entry.id}`, `Project ${index + 1} name`);
          validateRequiredText(errors, values, `prole-${entry.id}`, `Project ${index + 1} role`);
          validateRequiredText(errors, values, `pdesc-${entry.id}`, `Project ${index + 1} description`);
        });
        break;

      case 7:
        referenceList.forEach((entry, index) => {
          const allFields = [`rn-${entry.id}`, `rr-${entry.id}`, `ro-${entry.id}`, `rc-${entry.id}`];
          if (!rowHasAnyValue(values, allFields)) return;

          validateRequiredText(errors, values, `rn-${entry.id}`, `Reference ${index + 1} name`);
          validateRequiredText(errors, values, `rc-${entry.id}`, `Reference ${index + 1} contact info`);
          validateOptionalNameLikeText(errors, values, `rn-${entry.id}`, `Reference ${index + 1} name`);

          const contactInfo = getFormValue(values, `rc-${entry.id}`);
          if (
            contactInfo &&
            !isValidEmail(contactInfo) &&
            !isValidPhoneNumber(contactInfo)
          ) {
            addValidationError(errors, `rc-${entry.id}`, `Reference ${index + 1} contact info should be a valid email or phone number.`);
          }
        });
        break;

      default:
        addValidationError(errors, "_form", "Invalid CV step.");
    }

    return errors;
  };

  const validateAllSteps = (
    values: Record<string, string> = formData,
  ): ValidationErrors => {
    return [1, 2, 3, 4, 5, 6, 7].reduce<ValidationErrors>((allErrors, step) => {
      return { ...allErrors, ...validateStep(step, values) };
    }, {});
  };

  const isStepComplete = (stepId: number = expandedStepId) => {
    return Object.keys(validateStep(stepId)).length === 0;
  };

  const isFormValid = () => {
    return Object.keys(validateAllSteps()).length === 0;
  };

  const handleValidationErrors = (errors: ValidationErrors) => {
    const firstFieldId = getFirstActionableErrorFieldId(errors);
    const firstErrorMessage = firstFieldId ? errors[firstFieldId] : errors._form;
    const targetStepId = firstFieldId ? getStepIdForField(firstFieldId) : null;

    setValidationErrors(errors);
    setBuildError(
      firstErrorMessage
        ? `Please fix the highlighted fields. ${firstErrorMessage}`
        : "Please fix the highlighted fields.",
    );

    if (targetStepId) {
      setActiveStepId(targetStepId);
      setExpandedStepId(targetStepId);
      setSidebarExpandedId(targetStepId);
    }

    if (firstFieldId) {
      setPendingFocusFieldId(firstFieldId);
    }
  };

  const clearValidationErrors = () => {
    setValidationErrors({});
    setBuildError(null);
    setPendingFocusFieldId(null);
  };

  const handleSubmit = async () => {
    const errors = validateAllSteps();
    if (Object.keys(errors).length > 0) {
      handleValidationErrors(errors);
      return;
    }

    clearValidationErrors();

    if (isAuthLoading) { setBuildError("Checking your session. Please try again."); return; }
    if (!user?.id) { setBuildError("Please sign in first to build your CV."); return; }
    setIsBuilding(true);
    setIsFinished(false);
    setBuildError(null);
    resetUploadState();
    try {
      const payload = toBuilderPayload(
        formData,
        educationList,
        langList,
        skillList,
        certList,
        awardList,
        experienceList,
        projectList,
        referenceList,
      );

      const pdfBlob = await cvService.buildCV(user.id, payload);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const url = URL.createObjectURL(pdfBlob);
      setDownloadUrl(url);
      setDownloadBlob(pdfBlob);
      setDownloadName(
        toSafePdfFileName(`${getFormValue(formData, "name") || "careerics"}_CV`, "careerics_CV"),
      );
      setIsFinished(true);
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : "Failed to build CV. Please try again.");
    } finally {
      setIsBuilding(false);
    }
  };

  const handleSaveToGoogleDrive = async () => {
    if (driveOpenLink) {
      window.open(driveOpenLink, "_blank", "noopener,noreferrer");
      return;
    }

    const driveTab = openGoogleDriveLoadingWindow();
    const hasDriveAccess = await ensureGoogleDriveAccess({
      popupWindow: driveTab,
    });
    if (!hasDriveAccess) {
      closeGoogleDriveWindow(driveTab);
      return;
    }

    renderGoogleDriveLoadingWindow(driveTab);
    const uploaded = await uploadToGoogleDrive(downloadBlob, {
      fileName: downloadName,
      mimeType: downloadBlob?.type || "application/pdf",
    });

    const nextDriveLink = uploaded?.webViewLink ?? uploaded?.webContentLink ?? null;
    if (nextDriveLink) {
      navigateGoogleDriveWindow(driveTab, nextDriveLink);
      return;
    }

    closeGoogleDriveWindow(driveTab);
  };

  const selectedCountry = Country.getAllCountries().find(
    (country) => country.name === formData["country"],
  );

  const stateOptions = selectedCountry?.isoCode
    ? (State.getStatesOfCountry(selectedCountry.isoCode) || []).map((state) => state.name)
    : [];

  const ALL_LANGUAGES = ISO6391.getAllNames().sort();
  const PROFICIENCY_LEVELS = [
    "elementary",
    "conversational",
    "proficient",
    "full professional",
    "native/bilingual",
  ];
  const validationSummaryMessages = getValidationSummaryMessages(validationErrors);

  return (
    <Interview
      key={activeStepId}
      title="CV/Resume Form"
      questions={cvSteps}
      currentActiveId={sidebarExpandedId}
      onQuestionClick={(id) => {
        setSidebarExpandedId(id);
        setExpandedStepId(id);
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="scroll-area"
          style={{
            width: "100%",
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
            gap: "1vh",
            padding: isMedium ? "0 var(--space-md)" : "0",
            boxSizing: "border-box",
          }}
        >
          {isBuilding ? (
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div style={{ maxWidth: "var(--container-sm)" }}>
                <Animation message="" />
              </div>
            </div>
          ) : isFinished ? (
            <div style={{ padding: isCompactScreen ? "var(--space-md)" : "var(--space-xl)", width: "100%" }}>
              <h2
                style={{
                  color: "var(--white)",
                  fontSize: isSmall ? "var(--text-lg)" : "var(--text-2xl)",
                  fontFamily: "var(--font-nova-square)",
                  marginBottom: "var(--space-md)",
                }}
              >
                Ready to see your CV?
              </h2>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2xl)",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <InterviewCard
                  questionTitle=""
                  videoBoxStyle={{
                    background: "rgba(255, 255, 255, 0.41)",
                    width: "100%",
                    minHeight: isCompactScreen ? "auto" : "360px",
                    borderRadius: "var(--radius-2xl)",
                  }}
                  videoContent={
                    <div
                      style={{
                        display: "flex",
                        // ── Stack vertically on small; side-by-side on medium+ ──
                        flexDirection: isSmall ? "column" : "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: isSmall ? "var(--space-lg)" : "var(--space-xl)",
                        padding: isCompactScreen ? "var(--space-lg)" : "var(--space-2xl)",
                        minHeight: isCompactScreen ? "auto" : "360px",
                        flexWrap: "wrap",
                      }}
                    >
                      {/* PDF thumbnail — hidden on small to save space */}
                      {!isSmall && (
                        <div
                          style={{
                            width: isMedium ? "min(28vw, 180px)" : "min(38vw, 220px)",
                            height: isMedium ? "min(38vw, 240px)" : "min(52vw, 300px)",
                            minWidth: "140px",
                            minHeight: "180px",
                            borderRadius: "var(--radius-xl)",
                            flexShrink: 0,
                            boxShadow: "0 18px 42px rgba(0,0,0,0.2)",
                            overflow: "hidden",
                          }}
                        >
                          <PdfPreviewFrame
                            src={downloadUrl}
                            title="Generated CV preview"
                          />
                        </div>
                      )}

                      {/* Action buttons */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "var(--space-lg)",
                          // Full width on small so buttons stretch nicely
                          width: isSmall ? "100%" : "auto",
                        }}
                      >
                        <a
                          href={downloadUrl ?? "#"}
                          download={downloadName}
                          style={{
                            backgroundColor: "var(--primary-green)",
                            color: "var(--text-inverted)",
                            border: "none",
                            padding: "var(--button-padding-y) var(--button-padding-x)",
                            borderRadius: "var(--button-radius)",
                            fontWeight: "bold",
                            width: isSmall ? "100%" : "240px",
                            textAlign: "center",
                            textDecoration: "none",
                            pointerEvents: downloadUrl ? "auto" : "none",
                            opacity: downloadUrl ? 1 : 0.5,
                            boxSizing: "border-box",
                          }}
                        >
                          Download CV
                        </a>

                        <span
                          style={{
                            color: "var(--white)",
                            textAlign: "center",
                            opacity: 0.6,
                          }}
                        >
                          or
                        </span>

                        <button
                          type="button"
                          onClick={() => void handleSaveToGoogleDrive()}
                          disabled={isSavingToDrive || !downloadBlob}
                          style={{
                            backgroundColor: "var(--white)",
                            color: "var(--text-inverted)",
                            border: "none",
                            padding: "var(--button-padding-y) var(--button-padding-x)",
                            borderRadius: "var(--radius-lg)",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            width: isSmall ? "100%" : "240px",
                            justifyContent: "center",
                            cursor: isSavingToDrive || !downloadBlob ? "default" : "pointer",
                            opacity: isSavingToDrive || !downloadBlob ? 0.7 : 1,
                            boxSizing: "border-box",
                          }}
                        >
                          <img src="/global/drive.svg" style={{ width: "18px" }} alt="Drive" />
                          {isSavingToDrive
                            ? "Opening Drive..."
                            : uploadedDriveFile
                              ? "Saved to Google Drive"
                              : "Save to Google Drive"}
                        </button>

                        {driveUploadError ? (
                          <p
                            style={{
                              color: "var(--light-red)",
                              width: isSmall ? "100%" : "240px",
                              margin: 0,
                              textAlign: "center",
                            }}
                          >
                            {driveUploadError}
                          </p>
                        ) : null}

                        {uploadedDriveFile ? (
                          <p
                            style={{
                              color: "var(--primary-green)",
                              width: isSmall ? "100%" : "240px",
                              margin: 0,
                              textAlign: "center",
                            }}
                          >
                            Saved to Google Drive.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  }
                />
              </div>
            </div>
          ) : (
            <>
              <h2
                style={{
                  color: "var(--white)",
                  fontSize: isSmall ? "var(--text-lg)" : "var(--text-xl)",
                  fontFamily: "var(--font-nova-square)",
                }}
              >
                {cvSteps.find((step) => step.id === expandedStepId)?.title}
              </h2>

              {isPrefillingProfile ? (
                <p
                  style={{
                    color: "var(--light-blue)",
                    fontFamily: "var(--font-jura)",
                    marginTop: 0,
                  }}
                >
                  Loading your latest saved CV data...
                </p>
              ) : null}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-sm)",
                  // 👇 Hna kbbarna el-عرض f-el-mobile wel-tablet 3ashan ya7od msa7a akbar w maykonsh makhnooq
                  width: isSmall || isMedium ? "130%" : "100%",
                  maxWidth: isSmall ? "170%" : isMedium ? "90%" : "800px",
                  padding: isSmall ? "0 var(--space-xs)" : "0", // Padding khfeef 3al mobile 3ashan maylza2sh f-el-shasha
                  boxSizing: "border-box"
                }}
              >
                {expandedStepId === 1 && (
                  <DynamicCVForm
                    values={formData}
                    onChange={handleInputChange}
                    errors={validationErrors}
                    fields={[
                      { id: "name", type: "text", placeholder: "Full Name" },
                      {
                        id: "row1",
                        type: "row",
                        fields: [
                          { id: "job", type: "text", placeholder: "Job Title" },
                          { id: "port", type: "text", placeholder: "Portfolio (Optional)" },
                        ],
                      },
                      { id: "sum", type: "textarea", placeholder: "Summary" },
                      {
                        id: "loc-row",
                        type: "row",
                        fields: [
                          {
                            id: "country",
                            type: "select",
                            placeholder: "Country",
                            options: Country.getAllCountries().map((country) => country.name),
                          },
                          {
                            id: "city",
                            type: "select",
                            placeholder: "City",
                            options: stateOptions,
                          },
                        ],
                      },
                      { id: "phone", type: "text", placeholder: "Phone Number" },
                      { id: "email", type: "email", placeholder: "Email Address" },
                      { id: "link", type: "text", placeholder: "Linkedin Profile" },
                    ]}
                  />
                )}

                {expandedStepId === 2 && (
                  <>
                    {educationList.map((entry, index) => (
                      <div
                        key={entry.id}
                        style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-xxs)", maxWidth: "100%" }}
                      >
                        <span style={{ color: "var(--white)", opacity: 0.7 }}>{index + 1}.</span>
                        <div style={{ flex: 1, maxWidth: "100%" }}>
                          <DynamicCVForm
                            values={formData}
                            onChange={handleInputChange}
                            errors={validationErrors}
                            fields={[
                              { id: `inst-${entry.id}`, type: "text", placeholder: "Institution's name" },
                              {
                                id: `r-${entry.id}`,
                                type: "row",
                                fields: [
                                  {
                                    id: `q-${entry.id}`,
                                    type: "select",
                                    placeholder: "Qualification",
                                    options: ["Bachelor's", "Master's", "PhD", "Diploma"],
                                  },
                                  { id: `t-${entry.id}`, type: "text", placeholder: "Time period" },
                                ],
                              },
                            ]}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id, educationList, setEducationList)}
                          style={{ position:"absolute", right: "0" }}
                        >
                          <img
                            src="/cv/trash.svg"
                            alt=""
                            aria-hidden="true"
                            style={{ width: "20px", filter: "invert(0.7)", cursor: "pointer" }}
                          />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addEntry(educationList, setEducationList)}
                      style={{
                        color: "var(--primary-green)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: "var(--space-2xl)",
                      }}
                    >
                      + Add another degree
                    </button>
                  </>
                )}

                {expandedStepId === 3 && (
                  <>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      <div style={{ minWidth: "10px" }} />
                      <div style={{ flex: 1 }}>
                        {langList.map((entry, index) => (
                          <div
                            key={entry.id}
                            style={{ display: "flex", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}
                          >
                            <span
                              style={{
                                color: "var(--white)",
                                opacity: 0.7,
                                marginTop: "var(--space-md)",
                                minWidth: "10px",
                              }}
                            >
                              {index + 1}.
                            </span>
                            <div style={{ flex: 1 }}>
                              <DynamicCVForm
                                values={formData}
                                onChange={handleInputChange}
                                errors={validationErrors}
                                fields={[
                                  {
                                    id: `lrow-${entry.id}`,
                                    type: "row",
                                    fields: [
                                      {
                                        id: `ln-${entry.id}`,
                                        type: "select",
                                        placeholder: "Language",
                                        options: ALL_LANGUAGES,
                                      },
                                      {
                                        id: `lp-${entry.id}`,
                                        type: "select",
                                        placeholder: "Proficiency",
                                        options: PROFICIENCY_LEVELS,
                                      },
                                    ],
                                  },
                                ]}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id, langList, setLangList)}
                              style={{ position:"absolute", right: "0" }}
                            >
                              <img
                                src="/cv/trash.svg"
                                alt=""
                                aria-hidden="true"
                                style={{ width: "20px", filter: "invert(0.7)" }}
                              />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addEntry(langList, setLangList)}
                          style={{
                            color: "var(--primary-green)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            marginBottom: "var(--space-2xl)",
                          }}
                        >
                          + Add language
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      <div style={{ minWidth: "10px" }} />
                      <div style={{ flex: 1 }}>
                        {skillList.map((entry, index) => (
                          <div
                            key={entry.id}
                            style={{ display: "flex", marginBottom: "var(--space-sm)" }}
                          >
                            <span
                              style={{
                                color: "var(--white)",
                                opacity: 0.7,
                                marginTop: "var(--space-md)",
                                minWidth: "10px",
                              }}
                            >
                              {index + 1}.
                            </span>
                            <div style={{ flex: 1 }}>
                              <DynamicCVForm
                                values={formData}
                                onChange={handleInputChange}
                                errors={validationErrors}
                                fields={[
                                  {
                                    id: `srow-${entry.id}`,
                                    type: "row",
                                    fields: [
                                      { id: `sn-${entry.id}`, type: "text", placeholder: "Skill" },
                                      {
                                        id: `sp-${entry.id}`,
                                        type: "select",
                                        placeholder: "Level",
                                        options: ["Beginner", "Intermediate", "proficient", "Expert"],
                                      },
                                    ],
                                  },
                                ]}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id, skillList, setSkillList)}
                              style={{ position: "absolute", right: "0" }}
                            >
                              <img
                                src="/cv/trash.svg"
                                alt=""
                                aria-hidden="true"
                                style={{ width: "20px", filter: "invert(0.7)" }}
                              />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addEntry(skillList, setSkillList)}
                          style={{
                            color: "var(--primary-green)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          + Add skill
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {expandedStepId === 4 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2xl)" }}>
                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      <div style={{ minWidth: "10px" }} />
                      <div style={{ flex: 1 }}>
                        {certList.map((entry, index) => (
                          <div
                            key={entry.id}
                            style={{
                              display: "flex",
                              gap: "var(--space-sm)",
                              marginBottom: "var(--space-sm)",
                              alignItems: "flex-start",
                            }}
                          >
                            <span
                              style={{
                                color: "var(--white)",
                                opacity: 0.7,
                                marginTop: "var(--space-md)",
                                minWidth: "10px",
                              }}
                            >
                              {index + 1}.
                            </span>
                            <div style={{ flex: 1 }}>
                              <DynamicCVForm
                                values={formData}
                                onChange={handleInputChange}
                                errors={validationErrors}
                                fields={[
                                  { id: `cname-${entry.id}`, type: "text", placeholder: "Certificate Title" },
                                  {
                                    id: `cd-${entry.id}`,
                                    type: "row",
                                    fields: [
                                      { id: `corg-${entry.id}`, type: "text", placeholder: "Organization" },
                                      { id: `cdate-${entry.id}`, type: "text", placeholder: "Date" },
                                    ],
                                  },
                                ]}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id, certList, setCertList)}
                              style={{ position:"absolute", right: "0" }}
                            >
                              <img
                                src="/cv/trash.svg"
                                alt=""
                                aria-hidden="true"
                                style={{ width: "20px", filter: "invert(0.7)" }}
                              />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addEntry(certList, setCertList)}
                          style={{
                            color: "var(--primary-green)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          + Add certificate
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                      <div style={{ minWidth: "10px" }} />
                      <div style={{ flex: 1 }}>
                        {awardList.map((entry, index) => (
                          <div
                            key={entry.id}
                            style={{
                              display: "flex",
                              gap: "var(--space-sm)",
                              marginBottom: "var(--space-sm)",
                              alignItems: "flex-start",
                            }}
                          >
                            <span
                              style={{
                                color: "var(--white)",
                                opacity: 0.7,
                                marginTop: "var(--space-md)",
                                minWidth: "10px",
                              }}
                            >
                              {index + 1}.
                            </span>
                            <div style={{ flex: 1 }}>
                              <DynamicCVForm
                                values={formData}
                                onChange={handleInputChange}
                                errors={validationErrors}
                                fields={[
                                  { id: `aname-${entry.id}`, type: "text", placeholder: "Award Title" },
                                  {
                                    id: `ad-${entry.id}`,
                                    type: "row",
                                    fields: [
                                      { id: `aorg-${entry.id}`, type: "text", placeholder: "Issuer / Organization" },
                                      { id: `adate-${entry.id}`, type: "text", placeholder: "Year" },
                                    ],
                                  },
                                ]}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id, awardList, setAwardList)}
                               style={{ position:"absolute", right: "0" }}
                            >
                              <img
                                src="/cv/trash.svg"
                                alt=""
                                aria-hidden="true"
                                style={{ width: "20px", filter: "invert(0.7)" }}
                              />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addEntry(awardList, setAwardList)}
                          style={{
                            color: "var(--primary-green)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          + Add award
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {expandedStepId === 5 && (
                  <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <div style={{ minWidth: "10px" }} />
                    <div style={{ flex: 1 }}>
                      {experienceList.map((entry, index) => (
                        <div
                          key={entry.id}
                          style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}
                        >
                          <span
                            style={{
                              color: "var(--white)",
                              opacity: 0.7,
                              marginTop: "var(--space-md)",
                              minWidth: "10px",
                            }}
                          >
                            {index + 1}.
                          </span>
                          <div style={{ flex: 1 }}>
                            <DynamicCVForm
                              values={formData}
                              onChange={handleInputChange}
                              errors={validationErrors}
                              fields={[
                                { id: `role-${entry.id}`, type: "text", placeholder: "Role" },
                                {
                                  id: `row-${entry.id}`,
                                  type: "row",
                                  fields: [
                                    { id: `org-${entry.id}`, type: "text", placeholder: "Organization" },
                                    { id: `tp-${entry.id}`, type: "text", placeholder: "Time Period" },
                                  ],
                                },
                                { id: `resp-${entry.id}`, type: "textarea", placeholder: "Responsibilities" },
                              ]}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id, experienceList, setExperienceList)}
                  style={{ position:"absolute", right: "0" }}
                          >
                            <img
                              src="/cv/trash.svg"
                              alt=""
                              aria-hidden="true"
                              style={{ width: "20px", filter: "invert(0.7)" }}
                            />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addEntry(experienceList, setExperienceList)}
                        style={{
                          color: "var(--primary-green)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        + Add experience
                      </button>
                    </div>
                  </div>
                )}

                {expandedStepId === 6 && (
                  <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <div style={{ minWidth: "10px" }} />
                    <div style={{ flex: 1 }}>
                      {projectList.map((entry, index) => (
                        <div
                          key={entry.id}
                          style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}
                        >
                          <span
                            style={{
                              color: "var(--white)",
                              opacity: 0.7,
                              marginTop: "var(--space-md)",
                              minWidth: "10px",
                            }}
                          >
                            {index + 1}.
                          </span>
                          <div style={{ flex: 1 }}>
                            <DynamicCVForm
                              values={formData}
                              onChange={handleInputChange}
                              errors={validationErrors}
                              fields={[
                                { id: `pname-${entry.id}`, type: "text", placeholder: "Project Name" },
                                { id: `prole-${entry.id}`, type: "text", placeholder: "Your Role" },
                                { id: `ptech-${entry.id}`, type: "text", placeholder: "Technologies Used" },
                                { id: `pdesc-${entry.id}`, type: "textarea", placeholder: "Description" },
                                { id: `pach-${entry.id}`, type: "textarea", placeholder: "Key Achievements" },
                              ]}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id, projectList, setProjectList)}
                             style={{ position:"absolute", right: "0" }}
                          >
                            <img
                              src="/cv/trash.svg"
                              alt=""
                              aria-hidden="true"
                              style={{ width: "20px", filter: "invert(0.7)" }}
                            />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addEntry(projectList, setProjectList)}
                        style={{
                          color: "var(--primary-green)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        + Add project
                      </button>
                    </div>
                  </div>
                )}

                {expandedStepId === 7 && (
                  <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                    <div style={{ minWidth: "10px" }} />
                    <div style={{ flex: 1 }}>
                      {referenceList.map((entry, index) => (
                        <div
                          key={entry.id}
                          style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}
                        >
                          <span
                            style={{
                              color: "var(--white)",
                              opacity: 0.7,
                              marginTop: "var(--space-md)",
                              minWidth: "10px",
                            }}
                          >
                            {index + 1}.
                          </span>
                          <div style={{ flex: 1 }}>
                            <DynamicCVForm
                              values={formData}
                              onChange={handleInputChange}
                              errors={validationErrors}
                              fields={[
                                {
                                  id: `ref-row1-${entry.id}`,
                                  type: "row",
                                  fields: [
                                    { id: `rn-${entry.id}`, type: "text", placeholder: "Name" },
                                    { id: `rr-${entry.id}`, type: "text", placeholder: "Role" },
                                  ],
                                },
                                {
                                  id: `ref-row2-${entry.id}`,
                                  type: "row",
                                  fields: [
                                    { id: `ro-${entry.id}`, type: "text", placeholder: "Organization" },
                                    { id: `rc-${entry.id}`, type: "text", placeholder: "Contact Info" },
                                  ],
                                },
                              ]}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEntry(entry.id, referenceList, setReferenceList)}
                             style={{ position:"absolute", right: "0" }}
                          >
                            <img
                              src="/cv/trash.svg"
                              alt=""
                              aria-hidden="true"
                              style={{ width: "20px", filter: "invert(0.7)" }}
                            />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addEntry(referenceList, setReferenceList)}
                        style={{
                          color: "var(--primary-green)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        + Add reference
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {buildError ? (
                <div
                  style={{
                    color: "var(--light-red)",
                    fontFamily: "var(--font-jura)",
                    marginTop: "var(--space-xl)",
                  }}
                >
                  <p style={{ margin: 0 }}>{buildError}</p>
                  {validationSummaryMessages.length > 1 ? (
                    <ul
                      style={{
                        marginTop: "var(--space-sm)",
                        marginBottom: 0,
                        paddingLeft: "1.2rem",
                        display: "grid",
                        gap: "4px",
                      }}
                    >
                      {validationSummaryMessages.slice(0, 4).map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                      {validationSummaryMessages.length > 4 ? (
                        <li key="more-errors">
                          {`${validationSummaryMessages.length - 4} more field${validationSummaryMessages.length - 4 === 1 ? "" : "s"} need attention.`}
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* ── Next / Build CV button ── */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isSmall ? "stretch" : "flex-end",
                  position: "relative",
                  bottom: 0,
                  paddingBlock: "var(--space-md)",
                  zIndex: 5,
                }}
              >
                <Button
                  variant="primary"
                  onClick={() => {
                    if (expandedStepId === 7) {
                      void handleSubmit();
                      return;
                    }

                    const errors = validateStep(expandedStepId);
                    if (Object.keys(errors).length > 0) {
                      handleValidationErrors(errors);
                      return;
                    }

                    clearValidationErrors();

                    const next = expandedStepId + 1;
                    if (next > activeStepId) setActiveStepId(next);
                    setExpandedStepId(next);
                    setSidebarExpandedId(next);
                  }}
                  disabled={isBuilding}
                  isLoading={isBuilding}
                  style={{
                    // Stretch to full width on small screens ──
                    width: isSmall ? "100%" : undefined,
                    minWidth: isSmall ? undefined : "160px",
                    whiteSpace: "nowrap",
                    opacity:
                      isBuilding
                        ? 0.7
                        : expandedStepId === 7
                          ? isFormValid()
                            ? 1
                            : 0.5
                          : isStepComplete()
                            ? 1
                            : 0.5,
                    cursor: isBuilding ? "default" : "pointer",
                    transition: "opacity 0.3s ease",
                  }}
                >
                  {expandedStepId === 7 ? (isBuilding ? "Building..." : "Build CV") : "Next"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Interview>
  );
}
