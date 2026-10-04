# Prompt history

This record is included because the assignment asks candidates to submit prompt history. It preserves the user prompts that defined this project and labels the implementation brief distilled from them. The coding work was iterative; this is a concise prompt record, not a verbatim transcript of every internal tool operation.

## User prompt 1 — assignment brief

> **Optional Assignment: Please share GitHub repo URL for the project here**
>
> We plan to fast track candidates who complete an assignment to build a type of AI-powered application on Cloudflare. An AI-powered application should include these components:
>
> - LLM (recommend using Llama 3.3 on Workers AI), or an external LLM of your choice
> - Workflow / coordination (recommend Workflows, Workers or Durable Objects)
> - User input via chat or voice (recommend using Pages or Realtime)
> - Memory or state
>
> Find additional documentation at https://developers.cloudflare.com/agents/.
>
> Note: AI-assisted coding is encouraged, but you have to submit prompt history.

## User prompt 2 — project direction

> check out the best possbile project we can submit for me to the job applications

## Assistant-derived implementation brief

The following is the working brief distilled from the assignment above; it is written by the coding assistant, not a verbatim user prompt:

> Build RoleSignal, a polished Cloudflare career-preparation agent. Use a React interface served by a Worker, a streaming Agents SDK chat powered by Llama 3.3 on Workers AI, a Durable Object for per-browser profile/review/chat state, and a Cloudflare Workflow for a multi-step role analysis. Let candidates edit skills and outcome-based proof points, compare those facts with job requirements, and inspect linked evidence, gaps, next actions, interview prompts, and a draft cover letter. Make the score deterministic and explain its rubric. Label all sample details as fictional, never invent candidate claims, never submit applications, and document local setup, architecture, demo steps, and data limits. Include this prompt record in the repo.

## Implementation notes

- Cloudflare's official Agents starter was used as the base for the Workers, Agents SDK, and Vite setup.
- The fictional candidate and role are demo fixtures; they are not facts about the user.
- The model is instructed to use only supplied facts. Zod schemas check workflow inputs and outputs, evidence IDs are resolved against the supplied profile, and the fit score is calculated in application code.
- No employer communication or application-submission tool exists in the project.
