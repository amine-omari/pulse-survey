export type QuestionType = "text" | "scale" | "choice";

export type Question = {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // choice only
};

export type Survey = {
  code: string;
  title: string;
  questions: Question[];
  status: "open" | "closed";
};

export type Answers = Record<string, string | number>;

export type ResponseRow = {
  id: string;
  answers: Answers;
  created_at: string;
};

export type Results = Survey & {
  created_at: string;
  responses: ResponseRow[];
};

export const SCALE_MAX = 5;
