import React from "react";
import type { APIAssessmentQuestion, APISubmitAssessmentResponse } from "@/types";

export type AssessmentContextType = {
  userId: string;
  sessionId: string;
  questions: APIAssessmentQuestion[];
  userAnswers: Record<string, string>;
  setUserAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentQuestion: number;
  setCurrentQuestion: React.Dispatch<React.SetStateAction<number>>;
  expandedId: number;
  setExpandedId: React.Dispatch<React.SetStateAction<number>>;
  unlockedStepId: number;
  setUnlockedStepId: React.Dispatch<React.SetStateAction<number>>;
  resultsData: APISubmitAssessmentResponse | null;
  setResultsData: React.Dispatch<React.SetStateAction<APISubmitAssessmentResponse | null>>;
  startNewSession: () => Promise<void>;
  targetName: string;
};

export const AssessmentContext = React.createContext<AssessmentContextType | null>(null);

export function useAssessment() {
  const context = React.useContext(AssessmentContext);
  if (!context) {
    throw new Error("useAssessment must be used within an AssessmentProvider context wrapper.");
  }
  return context;
}