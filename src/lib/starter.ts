import type { Question } from "./types";

const choice = (id: string, text: string, options: string[]): Question => ({ id, text, type: "choice", options });
const scale10 = (id: string, text: string): Question => ({ id, text, type: "scale", min: 0, max: 10 });

export const STARTER_TITLE = "Rendy team meetup";

export const STARTER: Question[] = [
  choice("q4", "How do you feel about work right now?", ["Energized", "Fine, steady", "A bit lost", "Tired", "Frustrated"]),
  choice("q5", "Do you know what our #1 priority is this month?", ["Yes, clearly", "Roughly", "No", "I didn't know we had one"]),
  choice("q6", "Where do you lose the most time each week?", [
    "Waiting for answers or reviews",
    "Unclear requirements",
    "Redoing work and fixing bugs",
    "Messages and meetings",
    "Too much context switching",
  ]),
  choice("q7", "When you're blocked, what actually happens?", [
    "Unblocked the same day",
    "Takes 1-2 days",
    "Takes days, I switch to something else",
    "I figure it out alone and hope it's right",
  ]),
  choice("q8", "How do you know if your work mattered?", ["I see the numbers", "Someone tells me", "I assume it did", "I don't know"]),
  choice("q9", "What would help you most right now?", [
    "Clearer priorities",
    "Faster feedback",
    "Owning a whole area",
    "Better tools",
    "Fewer interruptions",
    "Better pay",
  ]),
  choice("q10", "What's the weakest part of Rendy today?", [
    "Speed and performance",
    "Quality of the reels",
    "Missing features",
    "Bugs",
    "UI and UX",
    "I don't use it enough to say",
  ]),
  choice("q11", "Honestly, which is closer to how you feel?", [
    "I'm an owner here",
    "Somewhat invested",
    "Mostly executing tasks",
    "Just doing what I'm assigned",
  ]),
  { id: "q12", text: "Rate these honestly", type: "info", body: "Four quick statements. 0 means not at all, 10 means completely." },
  scale10("q12a", "I know what we're working toward"),
  scale10("q12b", "I get unblocked fast"),
  scale10("q12c", "I have enough context to decide without asking"),
  scale10("q12d", "I'd tell a friend to work here"),
  { id: "q13", text: "What's the dumbest thing we do?", type: "text" },
  { id: "q14", text: "What's something we're getting wrong that nobody says out loud?", type: "text" },
  {
    id: "q15",
    text: "What happens next",
    type: "info",
    body: "Every answer gets sorted into: fix this week / fix this month / not now. I'll share the list in Discord within 48 hours.",
  },
  { id: "q16", text: "One thing I'll change about how I work:", type: "named" },
  { id: "q17", text: "What I commit to", type: "info", body: "Filled in live during the meetup." },
];
