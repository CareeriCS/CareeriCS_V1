"use client";

import JobBrowserPage from "@/app/job-features/_components/job-browser-page";

export default function JobApplicationPage() {
  return <JobBrowserPage mode="all" syncSelectionToUrl={false} showSortControls={false} />;
}
