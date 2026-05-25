/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { useResponsive } from "@/hooks/useResponsive";
import { profileService } from "@/services/profile.service";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const { isLarge, isMedium, isSmall } = useResponsive();

  const [hoveredNav, setHoveredNav] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [profileNameOverride, setProfileNameOverride] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadProfileName = async () => {
      if (!user?.id) {
        if (alive) {
          setProfileNameOverride(null);
        }
        return;
      }

      const response = await profileService.getUserProfile(user.id);
      if (!alive) {
        return;
      }

      if (response.success && response.data) {
        const nextName =
          response.data.full_name?.trim() ||
          response.data.username?.trim() ||
          null;
        setProfileNameOverride(nextName);
        return;
      }

      setProfileNameOverride(null);
    };

    void loadProfileName();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  

  const profileName = isLoading
    ? "Loading..."
    : profileNameOverride || user?.displayName?.trim() || "Guest";

  const navItems = [
    {
      text: "Home",
      image: "/sidebar/home.svg",
      selectedImage: "/sidebar/home-selected.svg",
      path: "/features/home",
    },
    {
      text: "Career Exploration",
      image: "/sidebar/career.svg",
      selectedImage: "/sidebar/career-selected.svg",
      path: "/features/career",
    },
    {
      text: "Roadmaps",
      image: "/sidebar/roadmap.svg",
      selectedImage: "/sidebar/roadmap-selected.svg",
      path: "/features/roadmap",
    },
    {
      text: "Courses Hub",
      image: "/sidebar/courses.svg",
      selectedImage: "/sidebar/courses-selected.svg",
      path: "/features/courses",
    },
    {
      text: "Skill Assessment",
      image: "/sidebar/skill.svg",
      selectedImage: "/sidebar/skill-selected.svg",
      path: "/features/skill",
    },
    {
      text: "CV Crafting",
      image: "/sidebar/cv.svg",
      selectedImage: "/sidebar/cv-selected.svg",
      path: "/features/cv",
    },
    {
      text: "Interview Preparation",
      image: "/sidebar/interview.svg",
      selectedImage: "/sidebar/interview-selected.svg",
      path: "/features/interview",
    },
    {
      text: "Job Search",
      image: "/sidebar/job.svg",
      selectedImage: "/sidebar/job-selected.svg",
      path: "/features/job",
    },
  ];

  const renderNav = (
    iconOnly = false,
    iconSize: string = "var(--icon-sm)"
  ) =>
    navItems.map((item, i) => {
      const isActive = pathname === item.path;
      const isHovered = hoveredNav === i;
      const activeState = isActive || isHovered;

      return (
        <Link
          key={item.path}
          href={item.path}
          style={{ textDecoration: "none" }}
        >
          <div
            title={item.text}
            onMouseEnter={() => setHoveredNav(i)}
            onMouseLeave={() => setHoveredNav(null)}
            onClick={() => isSmall && setIsOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-md)",
              padding: !isSmall?"var(--space-sm)":"var(--space-lg)",
              borderRadius: "var(--radius-lg)",
              cursor: "pointer",
              transition: "0.2s ease-in-out",
              backgroundColor: isActive
                ? "var(--primary-green)"
                : isHovered
                ? "var(--light-green)"
                : "transparent",
              color: activeState ? "#000" : "#fff",
            }}
          >
            <img
              src={activeState ? item.selectedImage : item.image}
              alt={item.text}
              style={{
                height: iconSize,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />

            {!iconOnly && item.text}
          </div>
        </Link>
      );
    });

  // ================= LARGE =================
  if (isLarge) {
    return (
      <aside
        style={{
          width: "fit-content",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "var(--space-md)",
          gap: "var(--space-md)",
          flexShrink: 0,
          color: "#fff",
        }}
      >
        <div
          style={{
            fontSize: "var(--text-lg)",
            fontFamily: "var(--font-nova-square)",
          }}
        >
          CareeriCS
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          {renderNav(false, "var(--icon-sm)")}
        </nav>

        <div
        onClick={()=>{router.push("/profile")}}
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-md)",
            paddingBlock: "var(--space-sm)",
            borderTop: "2px solid #fff",
          }}
        >
          <img
            src="/sidebar/profile.svg"
            alt="User"
            style={{ height: "var(--icon-md)" }}
          />

          <div style={{ cursor: "pointer" }}>
            {profileName}
          </div>
        </div>
      </aside>
    );
  }

  // ================= MEDIUM =================
  if (isMedium) {
    return (
      <aside
        style={{
          width: "fit-content",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "var(--space-md)",
          gap: "var(--space-md)",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          color: "#fff",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
        }}
      >
        <div
          style={{
            fontSize: "var(--icon-lg)",
            fontFamily: "var(--font-nova-square)",
          }}
        >
          CS
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
          }}
        >
          {renderNav(true, "var(--icon-lg)")}
        </nav>

        <img
        onClick={()=>{router.push("/profile")}}
          src="/sidebar/profile.svg"
          alt="User"
          style={{
            height: "var(--icon-lg)",
            cursor: "pointer",
          }}
        />
      </aside>
    );
  }

  // ================= SMALL =================
  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            top: "var(--space-md)",
            left: "var(--space-md)",
            zIndex: 2000,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#fff",
            fontSize: "var(--text-xl)",
          }}
        >
          ☰
        </button>
      )}

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 1999,
            }}
          />

          <aside
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100%",
              width: "260px",
              background: "#111",
              display: "flex",
              flexDirection: "column",
              padding: "var(--space-lg)",
              gap: "var(--space-md)",
              zIndex: 2000,
              color: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-lg)",
                  fontFamily: "var(--font-nova-square)",
                }}
              >
                CareeriCS
              </div>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                }}
              >
                ✕
              </button>
            </div>

            <nav
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-md)",
              }}
            >
              {renderNav(false, "var(--icon-sm)")}
            </nav>

            <div
              onClick={()=>{router.push("/profile")}}
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-md)",
                borderTop: "2px solid #fff",
                padding: "var(--space-md)",
              }}
            >
              <img
                src="/sidebar/profile.svg"
                alt="User"
                style={{
                  height: "var(--icon-xl)",
                  cursor: "pointer",
                }}
              />

              <div style={{ cursor: "pointer" }}>
                {profileName}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export default Sidebar;
