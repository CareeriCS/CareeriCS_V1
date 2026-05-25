"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookmarkCard from "@/components/ui/BookmarkCard";
import ContinueCard from "@/components/ui/ContinueCard";
import TipCard from "@/components/ui/3ateyat";
import LevelCard from "@/components/ui/LevelCard";
import { RectangularCard } from "@/components/ui/rectangular-card";
import { buildJobDetailsHref, mapApiJobToUiModel } from "@/lib/jobs";
import { useAuth } from "@/providers/auth-provider";
import { jobService } from "@/services";
import type { JobUiModel } from "@/types";
import { useResponsive } from "@/hooks/useResponsive";
import { InlineContainer } from "@/components/ui/containers/inline";
import { StackContainer } from "@/components/ui/containers/stack";

export default function JobHunt() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [recentlyViewedJobs, setRecentlyViewedJobs] = useState<JobUiModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    let isActive = true;

    const loadDashboard = async () => {
      setIsLoading(true);

      if (!user?.id) {
        if (!isActive) {
          return;
        }

        setRecentlyViewedJobs([]);
        setIsLoading(false);
        return;
      }

      const recentResponse = await jobService.getRecentlyViewedJobs(user.id, { limit: 12 });

      if (!isActive) {
        return;
      }

      setRecentlyViewedJobs(
        recentResponse.success
          ? recentResponse.data.jobs.map(mapApiJobToUiModel)
          : [],
      );
      setIsLoading(false);
    };

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [isAuthLoading, user?.id]);

  const { isLarge, isMedium, isSmall, width } = useResponsive();
  const RecentlyViewed = isSmall ? StackContainer : InlineContainer;

  return (
    <div
      style={{
        display: "grid",

        gridTemplateColumns: isLarge
          ? "1fr 2fr repeat(2, 1fr)"
          : isMedium
            ? "3fr 1fr"
            : "2fr 1fr",

        gridTemplateRows: isLarge
          ? "repeat(3, 1fr)"
          : isMedium
            ? "repeat(4, 1fr)"
            : "repeat(4, 1fr)",

        gridColumnGap: "var(--space-xl)",
        gridRowGap: "var(--space-xl)",

        padding: "var(--space-xl)",

        width: "100%",
        height: "100%",
      }}
    >
      {/* BOOKMARK CARD */}
      <div
        style={{
          gridArea: isLarge
            ? "1 / 1 / 2 / 3"
            : isMedium
              ? "2 / 1 / 3 / 3"
              : "2 / 1 / 3 / 3",
        }}
      >
        <BookmarkCard description="All of your saved jobs are here" />
      </div>

      {/* CONTINUE CARD */}
      <div
        style={{
          gridArea: isLarge
            ? "1 / 3 / 2 / 5"
            : isMedium
              ? "1 / 1 / 2 / 2"
              : "1 / 1 / 2 / 2",
        }}
      >
        <ContinueCard 
        description="Your next opportunity awaits" 
        style={{
          backgroundColor: isSmall?"var(--medium-blue)":"var(--dark-blue)",
        }} />
      </div>

      {/* TIP CARD */}

      {(!isSmall &&
        <div
          style={{
            gridArea: isLarge
              ? "2 / 1 / 3 / 5"
              : "3 / 1 / 4 / 3"
          }}
        >
          <TipCard
            title="Tip of the day"
            description="Research the company and interviewers before your interview so you understand the company's goals and show how you fit."
            icon="/global/tip.svg"
          />
        </div>
      )}

      {/* LEVEL CARD */}
      <div
        style={{
          gridArea: isLarge
            ? "3 / 1 / 4 / 2"
            : isMedium
              ? "1 / 2 / 2 / 3"
              : "1 / 2 / 2 / 3",
        }}
      >
        <LevelCard />
      </div>

      {/* RECENTLY VIEWED */}
      <RecentlyViewed
        style={{
          gridArea: isLarge
            ? "3 / 2 / 4 / 5"
            : isMedium
              ? "4 / 1 / 5 / 3"
              : "3 / 1 / 5 / 3",

          backgroundColor: "var(--dark-blue)",
        }}
        Title="Recently Viewed"
        centerTitle
        >
        {recentlyViewedJobs.length ? (
          recentlyViewedJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => router.push(buildJobDetailsHref(job.id))}
              style={{
                cursor: "pointer",
              }}
            >
              <RectangularCard
                Title={job.title}
                titleVariant={isSmall ? "full" : "clip"}
                isSubtextVisible
                subtext={job.company}
                variant="radio"
                font="nova"
                style={{
                  width: "100%",
                  flex: 1,
                }}
              />
            </div>
          ))
        ) : !isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "white",
              opacity: 0.8,
            }}
          >
            No recently viewed jobs yet.
          </div>
        ) : null}
      </RecentlyViewed>
    </div>
  );
}