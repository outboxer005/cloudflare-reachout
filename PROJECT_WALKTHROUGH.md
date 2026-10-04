# RoleSignal project walkthrough

Use this note to explain the project during a demo or interview.

## A short pitch

> RoleSignal is an evidence-first career-preparation agent. A candidate enters a job description and their verified skills and outcomes. It maps each requirement back to a real proof point, calls out unsupported areas, and creates a practical interview and application-preparation kit. A persistent chat agent helps refine the story. It never applies for jobs or contacts employers.

## How one review works

1. The React app connects to a named `CareerAgent` through the Agents SDK WebSocket. The agent is a Durable Object, so the workspace profile, role reviews, progress, and chat history persist between visits.
2. The candidate edits their profile and submits a role. The agent validates both, saves a queued review, then starts the `APPLICATION_REVIEW` Workflow.
3. The Workflow checkpoints four Workers AI steps: extract role requirements, map them to exact skill and proof-point IDs, draft next actions/interview questions/a cover letter, and summarize candidate positioning.
4. Zod validates the model output. The app resolves every proof-point ID against the candidate's profile and calculates the fit score itself with a published weighted rubric.
5. The agent saves the final analysis to workspace state. Workflow progress updates are sent back to the UI while the review runs.
6. The chat uses the candidate profile and selected role context to stream coaching replies. Chat messages are persisted by the Agents SDK.

## Where Cloudflare fits

| Assignment component    | RoleSignal implementation                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| LLM                     | Llama 3.3 70B FP8 Fast on Workers AI for structured analysis and streamed chat.                 |
| Workflow / coordination | Cloudflare Workflows for the checkpointed role-review stages and progress reporting.            |
| User input              | React role form and chat served by the Worker; Agents SDK WebSocket for chat and state updates. |
| Memory / state          | Durable Object workspace state plus persistent chat history.                                    |

## Demo path

1. Point out that the starter profile and Northstar Labs role are fictional.
2. Edit a skill or proof point and save the profile.
3. Load the sample role and start a review. Call out the progress stages while the Workflow runs.
4. In the result, compare a proof-backed match, a skill-only match, and a gap. Explain that the weighted score is a rubric, not a prediction of hiring odds.
5. Ask the chat to turn one proof point into an interview answer. Show how the assistant asks the candidate to supply missing facts instead of inventing them.

## Design choices to discuss

- **Why a Workflow?** Role review has several model calls and intermediate results. Checkpointed steps make progress explicit and allow work to resume without turning the whole process into one opaque request.
- **Why calculate the score in code?** Model-generated scores are hard to audit. Here, the model maps evidence; the deterministic weighted formula calculates the number.
- **Why keep proof-point IDs?** A reviewer can trace a match to the exact profile item. A listed skill without an outcome example cannot receive the strongest evidence label.
- **Why no apply button?** The app prepares a candidate to make a decision. It does not represent the candidate or take action on their behalf.
- **What would production need next?** Authentication and workspace authorization, deletion/export controls, retention settings, and abuse/rate controls. The current random browser workspace ID is routing, not authentication; the demo should only use fictional or non-sensitive data.
