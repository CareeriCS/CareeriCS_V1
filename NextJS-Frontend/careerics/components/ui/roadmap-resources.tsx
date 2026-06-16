"use client";

import { CourseCard } from "@/components/ui/courseCards";
import RoadmapResourceCard from "@/components/ui/roadmapResourceCard";
import StepCheckbox from "@/components/ui/roadmapStepCheckbox";
import React, { useState } from "react";

interface Resource {
  title: string;
  url: string;
  resourceType: string;
}

interface Skill {
  id: string;
  text: string;
  checked: boolean;
}

interface Section {
  resources: Resource[];
  skills: Skill[];
  locked?: boolean;
}

interface Course {
  id: string;
  title: string;
  provider: string;
}

interface RoadmapPanelContentProps {
  sectionAccessMessage?: string | null;
  selectedSection?: Section;
  selectedSectionCourses?: Course[];
  courseProgressError?: string | null;
  courseStatusById?: Partial<Record<string, "enrolled" | "completed">>
  toggleSkill: (index: number) => Promise<void>;
  handleCourseClick?: (course: Course) => void;
  courses?: boolean;
  title?: string;
}

export default function RoadmapPanelContent({
  sectionAccessMessage,
  selectedSection,
  selectedSectionCourses,
  courseProgressError,
  courseStatusById,
  toggleSkill,
  handleCourseClick,
  courses = true,
  title,
}: RoadmapPanelContentProps) {



  const [activePanelTab, setActivePanelTab] = useState<"resources" | "courses">("resources");
  const [openSkillId, setOpenSkillId] = useState<string | null>(null);

  return (
    <div
      style={{
        width: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        backgroundColor: courses?"var(--bg-grey)":"transparent",
        borderRadius: "var(--radius-xl)",
        flex: 1,
      }}
    >
      {courses &&
        <>
          {activePanelTab === "courses" &&

            <div
              style={{
                paddingTop: "var(--space-xs)",
                width: "100%",
                height: "fit-content",
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <div
                style={{
                  width: "fit-content",
                  backgroundColor: "var(--medium-blue)",
                  borderTopLeftRadius: "var(--radius-lg)",
                  cursor: "pointer",
                }}
              >

                <div
                  onClick={() => setActivePanelTab("resources")}
                  style={{
                    height: "fit-content",
                    backgroundColor: "var(--bg-grey)",
                    borderTopLeftRadius: "var(--radius-lg)",
                    borderBottomRightRadius: "var(--radius-lg)",
                    paddingInline: "var(--space-md)",
                    fontFamily: "var(--font-nova-square)",
                    fontSize: "var(--text-md)",
                    cursor: "pointer",
                  }}
                >
                  Topics
                </div>
              </div>
              <div
                style={{
                  height: "fit-content",
                  width: "100%",
                  backgroundColor: "var(--bg-grey)",
                  borderTopRightRadius: "var(--radius-lg)",
                  display: "flex",
                }}
              >
                <div
                  onClick={() => setActivePanelTab("courses")}
                  style={{
                    height: "fit-content",
                    backgroundColor: "var(--medium-blue)",
                    color: "white",
                    width: "fit-content",
                    borderTopRightRadius: "var(--radius-lg)",
                    borderTopLeftRadius: "var(--radius-lg)",
                    fontFamily: "var(--font-nova-square)",
                    fontSize: "var(--text-md)",
                    paddingInline: "var(--space-md)",
                    cursor: "pointer",
                  }}
                >
                  Courses
                </div>
                <div
                  style={{
                    minWidth: "0",
                    flex: 1,
                    width: "100%",
                    backgroundColor: "var(--medium-blue)",
                    borderTopRightRadius: "var(--radius-lg)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: "100%",
                      backgroundColor: "var(--bg-grey)",
                      borderTopRightRadius: "var(--radius-lg)",
                      borderBottomLeftRadius: "var(--radius-lg)",

                    }}
                  >
                  </div>
                </div>
              </div>
            </div>
          }

          {activePanelTab === "resources" &&
            <div
              style={{
                width: "100%",
                height: "fit-content",
                display: "flex",
                justifyContent: "flex-start",
                paddingTop: "var(--space-xs)",
              }}
            >
              <div
                onClick={() => setActivePanelTab("resources")}
                style={{
                  height: "fit-content",
                  backgroundColor: "var(--medium-blue)",
                  borderTopLeftRadius: "var(--radius-lg)",
                  borderTopRightRadius: "var(--radius-lg)",
                  paddingInline: "var(--space-md)",
                  fontFamily: "var(--font-nova-square)",
                  fontSize: "var(--text-md)",
                  color: "white",

                  cursor: "pointer",
                }}
              >
                Topics
              </div>
              <div
                style={{
                  height: "fit-content",
                  width: "100%",
                  borderTopRightRadius: "var(--radius-lg)",
                  backgroundColor: "var(--medium-blue)",
                }}
              >
                <div
                  onClick={() => setActivePanelTab("courses")}
                  style={{
                    height: "fit-content",
                    width: "100%",
                    borderTopRightRadius: "var(--radius-lg)",
                    backgroundColor: "var(--bg-grey)",
                    borderBottomLeftRadius: "var(--radius-lg)",
                    fontFamily: "var(--font-nova-square)",
                    fontSize: "var(--text-md)",
                    paddingInline: "var(--space-md)",
                    cursor: "pointer",
                  }}
                >
                  Courses
                </div>
              </div>

            </div>
          }
        </>
      }

      {!courses &&
        <div
        style={{
          fontSize:"var(--text-md)",
          textAlign:"center",
          fontFamily:"var(--font-nova-square)",
          paddingTop:"var(--space-sm)",
          color:"white",
        }}
        >
          {title}
        </div>
      }

      <div
        style={{
          backgroundColor: courses?"var(--medium-blue)":"transparent",
          flex: 1,
          borderRadius: "var(--radius-xl)",
          borderTopLeftRadius: activePanelTab === "courses" ? "var(--radius-xl)" : "0",
          padding: "var(--space-md)",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          gap: "var(--space-md)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            minHeight: 0,
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            paddingRight: "var(--space-xxs)",
            gap: "var(--space-md)",
          }}
        >
          {sectionAccessMessage ? (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--light-orange)",
                fontFamily: "var(--font-nova-square)",
                margin: 0,
              }}
            >
              {sectionAccessMessage}
            </p>
          ) : null}


          {!courses || activePanelTab === "resources" ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                {(selectedSection?.skills || []).map(
                  (skill: Skill, index: number) => (
                    <StepCheckbox
                      key={skill.id}
                      text={skill.text}
                      isChecked={skill.checked}
                      disabled={Boolean(selectedSection?.locked)}
                      isOpen={openSkillId === skill.id}
                      onOpen={() =>
                        setOpenSkillId(
                          openSkillId === skill.id ? null : skill.id
                        )
                      }
                      onToggle={() => {
                        void toggleSkill(index);
                      }}
                    >
                      {selectedSection?.resources.map((resource: Resource) => {
                        const key = `${resource.url}|${resource.title}|${resource.resourceType}`;

                        return (
                          <RoadmapResourceCard
                            key={key}
                            resourceType={resource.resourceType}
                            title={resource.title}
                            url={resource.url}
                          />
                        );
                      })}
                    </StepCheckbox>
                  )
                )}
              </div>
            </>
          ) : selectedSectionCourses?.length ?? 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                gap: "var(--space-md)",
                overflowY: "auto",
              }}
            >
              {courseProgressError ? (
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--light-orange)",
                    fontFamily: "var(--font-nova-square)",
                    margin: 0,
                  }}
                >
                  {courseProgressError}
                </p>
              ) : null}

              {(selectedSectionCourses ?? []).map((course: Course) => (
                <CourseCard
                  key={course.id}
                  title={course.title}
                  provider={course.provider}
                  onSelect={() => handleCourseClick?.(course)}
                  status={courseStatusById?.[course.id] ?? "default"}
                />
              ))}
            </div>
          ) : (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "white",
                fontFamily: "var(--font-nova-square)",
                margin: 0,
              }}
            >
              No courses available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}