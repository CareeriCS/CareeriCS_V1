"use client";
import React, { useState, useEffect, useCallback } from "react";
import FeatureCard from "@/components/ui/feature-card";
import type { CardType } from "@/components/ui/feature-card";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuth } from "@/providers/auth-provider";
import { buildAuthRedirectHref } from "@/lib/auth/post-auth-redirect";
import {
  buildCareerQuizSelectionHref,
  buildCareerQuizStartHref,
  startCareerQuizSession,
} from "@/lib/career-quiz";

type LayoutItem = {
  area: string;
  type: CardType;
};

type Layout = {
  gridTemplateColumns: string;
  gridTemplateRows: string;
  items: Record<string, LayoutItem>;
};

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;

  const [active, setActive] = useState("home");
  const [isStartingCareerQuiz, setIsStartingCareerQuiz] = useState(false);
  const [careerQuizError, setCareerQuizError] = useState<string | null>(null);

  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const sections = ["home", "toolkit", "journey"];

    const handleScroll = () => {
      let current = "home";

      sections.forEach((id) => {
        const section = document.getElementById(id);

        if (section) {
          const top = section.offsetTop - 120;


          if (window.scrollY >= top) {
            current = id;
          }
        }
      });

      setActive(current);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () =>
      window.removeEventListener("scroll", handleScroll);
  }, []);

  const getLinkColor = (id: string) => {
    if (active === id) return "var(--primary-green)";
    if (hovered === id) return "var(--light-green)";
    return "#fff";
  };

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // ensures correct state on first render

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const { isLarge, isMedium, isSmall } = useResponsive();

  const handleStartJourney = useCallback(async () => {
    if (isStartingCareerQuiz || isAuthLoading) return;

    const startHref = buildCareerQuizStartHref({
      origin: "home",
      returnTo: "/features/home",
    });

    if (!userId) {
      setCareerQuizError("Please sign in first to start your career quiz.");
      router.push(buildAuthRedirectHref("/auth/login", startHref));
      return;
    }

    setCareerQuizError(null);
    setIsStartingCareerQuiz(true);

    try {
      const quizId = await startCareerQuizSession(userId);
      router.push(
        buildCareerQuizSelectionHref(quizId, {
          origin: "home",
          returnTo: "/features/home",
        }),
      );
    } catch (err) {
      setCareerQuizError(err instanceof Error ? err.message : "Unable to start the career quiz right now. Please try again.");
      setIsStartingCareerQuiz(false);
    }
  }, [isAuthLoading, isStartingCareerQuiz, router, userId]);

  const getLayout = (): Layout => {
    if (isLarge) {
      return {
        gridTemplateColumns: "repeat(5, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        items: {
          careerQuiz: { area: "1 / 1 / 2 / 3", type: "horizontal" },
          cvBuilder: { area: "1 / 3 / 3 / 4", type: "vertical" },
          cvEnhancer: { area: "1 / 4 / 2 / 6", type: "horizontal" },
          roadmap: { area: "2 / 1 / 4 / 2", type: "vertical" },
          courses: { area: "2 / 2 / 3 / 3", type: "square" },
          hrInterview: { area: "2 / 4 / 3 / 5", type: "square" },
          job: { area: "2 / 5 / 4 / 6", type: "vertical" },
          skill: { area: "3 / 2 / 4 / 4", type: "horizontal" },
          techInterview: { area: "3 / 4 / 4 / 5", type: "square" },
        },
      };
    }

    if (isMedium) {
      return {
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "auto",
        items: {
          careerQuiz: { area: "1 / 1 / 2 / 3", type: "horizontal" },
          skill: { area: "1 / 3 / 3 / 4", type: "vertical" },
          roadmap: { area: "2 / 1 / 4 / 2", type: "vertical" },
          courses: { area: "2 / 2 / 3 / 3", type: "square" },
          cvBuilder: { area: "3 / 2 / 4 / 4", type: "horizontal" },
          cvEnhancer: { area: "4 / 1 / 5 / 3", type: "horizontal" },
          hrInterview: { area: "5 / 1 / 6 / 2", type: "square" },
          job: { area: "4 / 3 / 6 / 4", type: "vertical" },
          techInterview: { area: "5 / 2 / 6 / 3", type: "square" },
        },
      };
    }

    return {
      gridTemplateColumns: "repeat(2, 1fr)",
      gridTemplateRows: "auto",
      items: {
        careerQuiz: { area: "1 / 1 / 2 / 3", type: "horizontal" },
        roadmap: { area: "2 / 1 / 4 / 2", type: "vertical" },
        courses: { area: "2 / 2 / 3 / 3", type: "square" },
        skill: { area: "3 / 2 / 5 / 3", type: "vertical" },
        cvBuilder: { area: "4 / 1 / 6 / 2", type: "vertical" },
        cvEnhancer: { area: "5 / 2 / 6 / 3", type: "square" },
        hrInterview: { area: "6 / 1 / 7 / 2", type: "square" },
        techInterview: { area: "6 / 2 / 7 / 3", type: "square" },
        job: { area: "7 / 1 / 8 / 3", type: "horizontal" },
      },
    };
  };

  const layout = getLayout();

  return (
    <div
      style={{
        backgroundColor: "var(--bg-color)",
        color: "#fff",
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-lg)",
      }}
    >
      {/* NAVIGATION BAR */}
      <header
        style={{
          position: "fixed",
          width: "100%",
          height: "fit-content",
          backgroundColor: isScrolled ? "var(--bg-color)" : "transparent",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingInline: "var(--space-xl)",
          paddingBlock: "var(--space-md)",
          boxSizing: "border-box",
          zIndex: 1000,
          whiteSpace: "nowrap"
        }}
      >
       
          <div
            style={{
              fontSize: "var(--text-lg)",
              fontFamily: "var(--font-nova-square)",
              display:"flex",
              gap:"var(--space-md)",
              alignItems:"center",
            }}
          >
            <img
            src={"/global/logo.svg"}
            style={{
              height:"var(--icon-lg)",
            }}
            />
            {!isSmall && "CareeriCS"}
          </div>

        <nav
          style={{
            display: "flex",
            gap: "var(--space-2xl)",
            fontSize: "var(--text-base)",
            fontWeight: "500",
            fontFamily: "var(--font-jura)",
          }}
        >
          <a
            href="#home"
            style={{
              color: getLinkColor("home"),
              textDecoration: "none",
              transition: "color 0.25s ease",
            }}
            onMouseEnter={() => setHovered("home")}
            onMouseLeave={() => setHovered(null)}
          >
            Home
          </a>

          <a
            href="#toolkit"
            style={{
              color: getLinkColor("toolkit"),
              textDecoration: "none",
              transition: "color 0.25s ease",
            }}
            onMouseEnter={() => setHovered("toolkit")}
            onMouseLeave={() => setHovered(null)}
          >
            Toolkit
          </a>

          <a
            href="#journey"
            style={{
              color: getLinkColor("journey"),
              textDecoration: "none",
              transition: "color 0.25s ease",
            }}
            onMouseEnter={() => setHovered("journey")}
            onMouseLeave={() => setHovered(null)}
          >
            Journey Flow
          </a>
        </nav>

        <Button
          onClick={() => router.push("/auth/login")}
          size="md"
          style={{
            paddingInline: "var(--space-lg)",
            maxWidth: "fit-content",
          }}
          variant="outline"
        >
          Sign In
        </Button>
      </header>

      {/* Home */}
      <section
        id="home"
        style={{
          position: "relative",
          scrollMarginTop: "100px",
          backgroundColor: "var(--bg-color)",
          width: "100%",
          maxHeight: "100vh",
          height: "fit-content",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gridTemplateRows: "1fr",
          gridColumnGap: 0,
          gridRowGap: 0,
          background:
            "radial-gradient(circle at center, var(--phase5-color) -20%, rgba(0,0,0,0) 45%)",
        }}
      >
        {/* Careeri CS */}
        <div
          style={{
            gridArea: "1 / 1 / 2 / 3",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
            justifyContent: "flext-start",
            alignItems: "center",
            paddingTop: isSmall ? "10vh" : "20vh",
          }}
        >
          <svg
            preserveAspectRatio="none"
            viewBox="0 0 983 169"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              maxWidth: "70%",
            }}
          >
            <path
              d="M37.5977 164.355C12.5326 164.355 0 151.823 0 126.758V39.7461C0 14.681 12.5326 2.14844 37.5977 2.14844H70.8984C95.9635 2.14844 108.496 14.681 108.496 39.7461V51.5625L88.0859 61.2305H87.0117V39.7461C87.0117 27.5716 81.6406 21.4844 70.8984 21.4844H37.5977C26.8555 21.4844 21.4844 27.5716 21.4844 39.7461V126.758C21.4844 138.932 26.8555 145.02 37.5977 145.02H70.8984C81.6406 145.02 87.0117 138.932 87.0117 126.758V114.941L107.422 105.273H108.496V126.758C108.496 151.823 95.9635 164.355 70.8984 164.355H37.5977ZM172.949 145.02H195.508C202.669 145.02 206.25 140.723 206.25 132.129V117.412C206.25 108.818 202.669 104.521 195.508 104.521H172.949C165.788 104.521 162.207 108.818 162.207 117.412V132.129C162.207 140.723 165.788 145.02 172.949 145.02ZM172.949 164.355C151.465 164.355 140.723 153.613 140.723 132.129V117.412C140.723 95.9277 151.465 85.1855 172.949 85.1855H195.508C199.232 85.1855 202.812 86.2598 206.25 88.4082V78.418C206.25 69.8242 202.669 65.5273 195.508 65.5273H157.051V64.4531L165.645 46.1914H195.508C216.992 46.1914 227.734 56.9336 227.734 78.418V158.984L207.324 168.652H206.25V161.133C203.529 163.281 199.948 164.355 195.508 164.355H172.949ZM259.961 168.652V78.418C259.961 56.9336 270.703 46.1914 292.188 46.1914H319.043V47.2656L310.449 65.5273H292.188C285.026 65.5273 281.445 69.8242 281.445 78.418V158.984L261.035 168.652H259.961ZM369.531 164.355C348.047 164.355 337.305 153.613 337.305 132.129V78.418C337.305 56.9336 348.047 46.1914 369.531 46.1914H394.238C415.723 46.1914 426.465 56.9336 426.465 78.418V84.1113L359.111 136.211C360.114 142.083 363.587 145.02 369.531 145.02H394.238C401.4 145.02 404.98 140.723 404.98 132.129V126.436L425.391 116.768H426.465V132.129C426.465 153.613 415.723 164.355 394.238 164.355H369.531ZM358.789 113.76L404.873 76.5918C404.443 69.2155 400.898 65.5273 394.238 65.5273H369.531C362.37 65.5273 358.789 69.8242 358.789 78.418V113.76ZM490.918 164.355C469.434 164.355 458.691 153.613 458.691 132.129V78.418C458.691 56.9336 469.434 46.1914 490.918 46.1914H515.625C537.109 46.1914 547.852 56.9336 547.852 78.418V84.1113L480.498 136.211C481.501 142.083 484.974 145.02 490.918 145.02H515.625C522.786 145.02 526.367 140.723 526.367 132.129V126.436L546.777 116.768H547.852V132.129C547.852 153.613 537.109 164.355 515.625 164.355H490.918ZM480.176 113.76L526.26 76.5918C525.83 69.2155 522.285 65.5273 515.625 65.5273H490.918C483.757 65.5273 480.176 69.8242 480.176 78.418V113.76ZM580.078 168.652V78.418C580.078 56.9336 590.82 46.1914 612.305 46.1914H639.16V47.2656L630.566 65.5273H612.305C605.143 65.5273 601.562 69.8242 601.562 78.418V158.984L581.152 168.652H580.078ZM664.404 22.4512C661.898 19.873 660.645 16.7936 660.645 13.2129C660.645 9.56055 661.898 6.44531 664.404 3.86719C666.911 1.28906 669.954 0 673.535 0C677.116 0 680.16 1.28906 682.666 3.86719C685.173 6.44531 686.426 9.56055 686.426 13.2129C686.426 16.7936 685.173 19.873 682.666 22.4512C680.16 25.0293 677.116 26.3184 673.535 26.3184C669.954 26.3184 666.911 25.0293 664.404 22.4512ZM662.793 168.652V51.5625L683.203 41.8945H684.277V158.984L663.867 168.652H662.793ZM764.844 164.355C739.779 164.355 727.246 151.823 727.246 126.758V39.7461C727.246 14.681 739.779 2.14844 764.844 2.14844H798.145C823.21 2.14844 835.742 14.681 835.742 39.7461V51.5625L815.332 61.2305H814.258V39.7461C814.258 27.5716 808.887 21.4844 798.145 21.4844H764.844C754.102 21.4844 748.73 27.5716 748.73 39.7461V126.758C748.73 138.932 754.102 145.02 764.844 145.02H798.145C808.887 145.02 814.258 138.932 814.258 126.758V114.941L834.668 105.273H835.742V126.758C835.742 151.823 823.21 164.355 798.145 164.355H764.844ZM912.012 164.355C886.947 164.355 874.414 151.823 874.414 126.758V114.941L894.824 105.273H895.898V126.758C895.898 138.932 901.27 145.02 912.012 145.02H945.312C956.055 145.02 961.426 138.932 961.426 126.758V104.199C961.426 92.0247 956.055 85.9375 945.312 85.9375H916.309C894.824 85.9375 884.082 75.1953 884.082 53.7109V34.375C884.082 12.8906 894.824 2.14844 916.309 2.14844H941.016C962.5 2.14844 973.242 12.8906 973.242 34.375V40.0684L952.832 49.7363H951.758V34.375C951.758 25.7812 948.177 21.4844 941.016 21.4844H916.309C909.147 21.4844 905.566 25.7812 905.566 34.375V53.7109C905.566 62.3047 909.147 66.6016 916.309 66.6016H945.312C970.378 66.6016 982.91 79.1341 982.91 104.199V126.758C982.91 151.823 970.378 164.355 945.312 164.355H912.012Z"
              fill="url(#paint0_radial_1277_259)"
            />
            <defs>
              <radialGradient id="paint0_radial_1277_259" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(489.307 85.8555) scale(620.5 132.5)">
                <stop stopColor="white" />
                <stop offset="1" stopColor="#999999" />
              </radialGradient>
            </defs>
          </svg>

          {/* Your Guide To Success */}
          {!isSmall &&
          <div
          style={{
              zIndex: 1,
              minWidth: "fit-content",
              marginLeft: "auto",
              display: "grid",
              gridTemplateColumns: "1fr",
              gridTemplateRows: "1fr",
            }}
            >

            <p
              style={{
                fontFamily: "var(--font-nova-square)",
                whiteSpace: "nowrap",
                zIndex: "2",
                gridArea: "1/1/2/2",
              }}
              >
              Your Guide To Success
            </p>
            <svg
              preserveAspectRatio="none"
              viewBox="0 0 578 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                width: "100%",
                zIndex: "1",
                gridArea: "1/1/2/2",
              }}
              >
              <path
                d="M-8.15392e-05 54.3333C-8.15392e-05 57.2789 2.38773 59.6667 5.33325 59.6667C8.27877 59.6667 10.6666 57.2789 10.6666 54.3333C10.6666 51.3878 8.27877 49 5.33325 49C2.38773 49 -8.15392e-05 51.3878 -8.15392e-05 54.3333ZM567 5.33334C567 8.27886 569.388 10.6667 572.333 10.6667C575.279 10.6667 577.667 8.27886 577.667 5.33334C577.667 2.38782 575.279 1.00136e-05 572.333 1.00136e-05C569.388 1.00136e-05 567 2.38782 567 5.33334ZM399.833 5.33334V4.33334H399.577L399.353 4.4562L399.833 5.33334ZM310.333 54.3333V55.3333H310.589L310.813 55.2105L310.333 54.3333ZM399.833 5.33334V6.33334H572.333V5.33334V4.33334H399.833V5.33334ZM5.33325 54.3333V55.3333H310.333V54.3333V53.3333H5.33325V54.3333ZM310.333 54.3333L310.813 55.2105L400.313 6.21049L399.833 5.33334L399.353 4.4562L309.853 53.4562L310.333 54.3333Z"
                fill="white"
                />
            </svg>

          </div>
              }
        </div>

        {/* Subtext + Register */}
        <div
          style={{
            gridArea: "1 /1 / 2 / 2",
            zIndex: 1,
            fontFamily: "var(--font-jura)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--space-sm)",
            paddingTop: "30vh",
            width: "fit-content",
            justifySelf: "center",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-base)"
            }}
          >
            Not sure where to go <br />
            or how to start? Just <br />
            graduated and you <br />
            feel lost? <br />
            Careeri CS got your <br />
            back.
          </p>

          <Button
            onClick={() => router.push("/auth/register")}
            variant="primary"
            size="md"
            style={{ flex: 0, width: "100%" }}
          >
            Register
          </Button>
        </div>


        <div
          style={{
            gridArea: "1 / 2 / 2 / 3",
            zIndex: 1,
            fontFamily: "var(--font-jura)",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          {/* Landing Robot */}
          <img
            src="/landing/robot.svg"
            alt="Our Robot"
            style={{
              marginTop: "auto",
              maxHeight: "70%",
              zIndex: 1,
            }}
          />

        </div>
      </section>

      {/* Toolkit */}
      <section id="toolkit"
        style={{
          scrollMarginTop: "60px",
          textAlign: "center",
          backgroundColor: "var(--bg-color)",
          display: "flex",
          flexDirection: "column",
          padding: "var(--space-lg)",
          gap: "var(--space-lg)",
          alignItems: "center",
        }}>

        <h2
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: "500"
          }}
        >
          Choose from our various features
        </h2>


        <div
          style={{
            display: "grid",
            width: "85%",
            gridTemplateColumns: layout.gridTemplateColumns,
            gridTemplateRows: layout.gridTemplateRows,
            gap: "var(--space-lg)",
          }}
        >
          {/* Career Quiz */}
          <div style={{ gridArea: layout.items.careerQuiz.area }}>
            <FeatureCard
              type={layout.items.careerQuiz.type}
              title="Career Quiz"
              description={
                <>
                  Career confusion? We don’t know her.

                  Discover where you’ll thrive with our 5-minute Quiz.
                </>
              }
              color="var(--phase1-color)"
              link="/auth/login?redirect=/features/career"
            />
          </div>

          {/* CV Builder */}
          <div style={{ gridArea: layout.items.cvBuilder.area }}>
            <FeatureCard
              type={layout.items.cvBuilder.type}
              title={
                <>
                  CV
                  Builder
                </>
              }
              description={
                <>
                  Never had a CV before and you got no idea how to start?
                  Our AI model will build you an ATS-friendly CV.
                  No guesswork Just results.
                </>
              }
              color="var(--phase3-color)"
              link="/cv-feature/builder"
            />
          </div>

          {/* CV Enhancer */}
          <div style={{ gridArea: layout.items.cvEnhancer.area }}>
            <FeatureCard
              type={layout.items.cvEnhancer.type}
              title="CV Enhancer"
              description={
                <>
                  Already have a CV but it’s not getting you anywhere?
                  We’ll optimize it to get recruiters attention.
                </>
              }
              color="var(--phase3-color)"
              link="/cv-feature/enhancer"
            />
          </div>

          {/* Roadmap */}
          <div style={{ gridArea: layout.items.roadmap.area }}>
            <FeatureCard
              type={layout.items.roadmap.type}
              title={
                <>
                  Roadmap
                  Generation
                </>
              }
              description={
                <>
                  Unsure about your next steps?

                  Get a clear map towards your dream role.

                  We’ll tell you exactly what to learn and how.
                </>
              }
              color="var(--phase2-color)"
              link="/features/roadmap"
            />
          </div>

          {/* Courses */}
          <div style={{ gridArea: layout.items.courses.area }}>
            <FeatureCard
              type={layout.items.courses.type}
              title="Courses"
              description="Learn actual skills that match market demands."
              color="var(--phase2-color)"
              link="/features/courses"
            />
          </div>

          {/* HR Interview */}
          <div style={{ gridArea: layout.items.hrInterview.area }}>
            <FeatureCard
              type={layout.items.hrInterview.type}
              title="HR Interview"
              description="Practice the impossible questions."
              color="var(--phase4-color)"
              link="/features/interview"
            />
          </div>

          {/* Job */}
          <div style={{ gridArea: layout.items.job.area }}>
            <FeatureCard
              type={layout.items.job.type}
              title={
                <>
                  Job
                  Applicator
                </>
              }
              description={
                <>
                  Job hunting shouldn’t feel like a full time job.

                  We match you with the best opportunities.
                </>
              }
              color="var(--phase5-color)"
              link="/features/job"
            />
          </div>

          {/* Skill */}
          <div style={{ gridArea: layout.items.skill.area }}>
            <FeatureCard
              type={layout.items.skill.type}
              title="Skill Assessment"
              description="Find out where you truly stand. Identify strengths and gaps."
              color="var(--phase2-color)"
              link="/features/skill"
            />
          </div>

          {/* Tech Interview */}
          <div style={{ gridArea: layout.items.techInterview.area }}>
            <FeatureCard
              type={layout.items.techInterview.type}
              title="Tech Interview"
              description="Explain your mind clearly under pressure."
              color="var(--phase4-color)"
              link="/features/interview"
            />
          </div>
        </div>
      </section>



      {/* 4. ROADMAP SECTION */}
      <section id="journey"
        style={{
          scrollMarginTop: "70px",
          paddingBottom: "var(--space-xl)",
          textAlign: "center",
          background: "var(--bg-color)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-lg)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: "500"
          }}
        >
          Follow your personalized career journey
        </h3>

        <div
          style={{
            minWidth: "100%",
          }}
        >
          <img
            src="/landing/journey.svg"
            alt="Career Journey Roadmap"
            style={{ width: "100%", height: "auto" }}
          />
        </div>
        {careerQuizError && (
          <p
            style={{
              alignSelf: "flex-end",
              margin: 0,
              marginRight: "20vw",
              color: "#FFD3D3",
              fontFamily: "var(--font-jura)",
              fontSize: "0.95rem",
            }}
          >
            {careerQuizError}
          </p>
        )}
        <Button
          onClick={() => {
            void handleStartJourney();
          }}
          variant="primary"
          size="md"
          disabled={isStartingCareerQuiz || isAuthLoading}
          style={{
            flex: 0,
            width: "fit-content",
            marginLeft: "auto",
            marginRight: "20vw",
          }}
        >
          {isStartingCareerQuiz ? "Starting..." : "Start Your Journey"}
        </Button>
      </section>
    </div>
  );
}
