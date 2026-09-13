export type QuestionType = "text" | "named" | "scale" | "choice" | "info";

export type Question = {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[]; // choice only
  min?: number; // scale only, default 1
  max?: number; // scale only, default 5
  body?: string; // info only
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

export const scaleRange = (q: Question) => ({ min: q.min ?? 1, max: q.max ?? 5 });
export const nameKey = (id: string) => `${id}__name`;
export const isAnswerable = (q: Question) => q.type !== "info";
