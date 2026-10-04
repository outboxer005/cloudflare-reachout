import {
	AgentWorkflow,
	type AgentWorkflowEvent,
	type AgentWorkflowStep
} from "agents/workflows";
import { z } from "zod";
import {
	ApplicationReviewParamsSchema,
	RoleAnalysisSchema,
	type ApplicationReviewParams,
	type RoleAnalysis
} from "./contracts";
import type { CareerAgent } from "./server";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const RoleBriefDraftSchema = z.object({
	roleSummary: z.string().min(1).max(700),
	requirements: z
		.array(
			z.object({
				requirement: z.string().min(1).max(180),
				importance: z.enum(["must-have", "important", "nice-to-have"]),
				whyItMatters: z.string().min(1).max(240)
			})
		)
		.min(3)
		.max(8)
});

const MatchDraftSchema = z.object({
	matches: z
		.array(
			z.object({
				requirementId: z.string().min(1).max(48),
				strength: z.enum(["strong", "partial", "gap"]),
				proofPointId: z.string().nullable(),
				skillEvidence: z.string().nullable(),
				rationale: z.string().min(1).max(360)
			})
		)
		.min(1)
		.max(8)
});

const ApplicationKitDraftSchema = z.object({
	nextMoves: z
		.array(
			z.object({
				title: z.string().min(1).max(120),
				detail: z.string().min(1).max(360)
			})
		)
		.min(1)
		.max(5),
	interviewQuestions: z
		.array(
			z.object({
				question: z.string().min(1).max(280),
				angle: z.string().min(1).max(240)
			})
		)
		.min(1)
		.max(5),
	coverLetter: z.string().min(1).max(2600)
});

async function generateJson(
	ai: Env["AI"],
	system: string,
	prompt: string,
	maxTokens: number
) {
	const result = await ai.run(MODEL, {
		messages: [
			{ role: "system", content: system },
			{ role: "user", content: prompt }
		],
		response_format: { type: "json_object" },
		max_tokens: maxTokens,
		temperature: 0.2
	});

	let output: string | undefined;
	if (typeof result === "string") {
		output = result;
	} else if (result && typeof result === "object" && "response" in result) {
		output = typeof result.response === "string" ? result.response : undefined;
	}
	if (!output)
		throw new Error("Workers AI returned an empty structured response.");

	const firstBrace = output.indexOf("{");
	const lastBrace = output.lastIndexOf("}");
	if (firstBrace < 0 || lastBrace < firstBrace) {
		throw new Error("Workers AI did not return a JSON object.");
	}
	const parsed: unknown = JSON.parse(output.slice(firstBrace, lastBrace + 1));
	return parsed;
}

function calculateFitScore(requirements: RoleAnalysis["requirements"]) {
	const weight = { "must-have": 3, important: 2, "nice-to-have": 1 } as const;
	const strength = { strong: 1, partial: 0.5, gap: 0 } as const;
	const totalWeight = requirements.reduce(
		(sum, item) => sum + weight[item.importance],
		0
	);
	const score = requirements.reduce(
		(sum, item) => sum + weight[item.importance] * strength[item.strength],
		0
	);
	return totalWeight === 0 ? 0 : Math.round((score / totalWeight) * 100);
}

export class ApplicationReviewWorkflow extends AgentWorkflow<
	CareerAgent,
	ApplicationReviewParams
> {
	async run(
		event: AgentWorkflowEvent<ApplicationReviewParams>,
		step: AgentWorkflowStep
	): Promise<RoleAnalysis> {
		const params = ApplicationReviewParamsSchema.parse(event.payload);

		await this.reportProgress({
			step: "Read the role",
			status: "running",
			percent: 0.12,
			message: "Pulling out the role’s highest-signal requirements."
		});
		const brief = await step.do("extract-role-brief", async () => {
			const draft = RoleBriefDraftSchema.parse(
				await generateJson(
					this.env.AI,
					"You are a careful job-description analyst. Return valid JSON only. Extract concrete responsibilities and requirements from the supplied job description. Do not add requirements or company facts that are not present. Prefer 4 to 7 distinct requirements and classify importance as must-have, important, or nice-to-have.",
					JSON.stringify({
						company: params.company,
						title: params.title,
						jobDescription: params.description
					}),
					1100
				)
			);
			return {
				roleSummary: draft.roleSummary,
				requirements: draft.requirements.map((requirement, index) => ({
					id: `req-${index + 1}`,
					...requirement
				}))
			};
		});

		await this.reportProgress({
			step: "Map your evidence",
			status: "running",
			percent: 0.43,
			message: "Connecting requirements to your confirmed proof points."
		});
		const matchedRequirements = await step.do(
			"map-candidate-evidence",
			async () => {
				const draft = MatchDraftSchema.parse(
					await generateJson(
						this.env.AI,
						"You map job requirements to candidate evidence. Return valid JSON only. Use exact requirement IDs. A proofPointId must be copied exactly from the supplied proof points, otherwise use null. A skillEvidence must be copied exactly from the supplied skills, otherwise use null. Never invent experience, outcomes, dates, employers, or metrics. Use strong only when a proof point directly demonstrates the requirement. A listed skill without an outcome example can be partial, never strong. If neither a proof point nor a listed skill supports a requirement, mark it as a gap.",
						JSON.stringify({
							requirements: brief.requirements,
							skills: params.profile.skills,
							proofPoints: params.profile.proofPoints
						}),
						1500
					)
				);

				const matchById = new Map(
					draft.matches.map((match) => [match.requirementId, match])
				);
				return brief.requirements.map((requirement) => {
					const match = matchById.get(requirement.id);
					const evidence =
						params.profile.proofPoints.find(
							(point) => point.id === match?.proofPointId
						) ?? null;
					const skillEvidence =
						params.profile.skills.find(
							(skill) =>
								skill.toLowerCase() === match?.skillEvidence?.toLowerCase()
						) ?? null;

					let strength: "strong" | "partial" | "gap" = match?.strength ?? "gap";
					if (!match || (!evidence && !skillEvidence)) strength = "gap";
					else if (!evidence && skillEvidence && strength === "strong")
						strength = "partial";
					if (!evidence && !skillEvidence) strength = "gap";

					return {
						id: requirement.id,
						requirement: requirement.requirement,
						importance: requirement.importance,
						whyItMatters: requirement.whyItMatters,
						strength,
						rationale:
							match?.rationale ??
							"No confirmed evidence was returned for this requirement.",
						skillEvidence: evidence ? null : skillEvidence,
						evidence
					};
				});
			}
		);

		const fitScore = calculateFitScore(matchedRequirements);
		const recommendation =
			fitScore >= 72
				? "strong-fit"
				: fitScore >= 45
					? "bridge-gaps"
					: "stretch";

		await this.reportProgress({
			step: "Build your application kit",
			status: "running",
			percent: 0.72,
			message:
				"Drafting next steps and interview practice from the evidence map."
		});
		const kit = await step.do("prepare-application-kit", async () => {
			const draft = ApplicationKitDraftSchema.parse(
				await generateJson(
					this.env.AI,
					"You are an evidence-first job application coach. Return valid JSON only. Draft practical next steps, interview questions, and a concise cover letter using only the candidate profile and verified evidence map. Do not invent qualifications, responsibilities, employers, dates, or metrics. Leave out unsupported claims. For each gap, recommend a truthful way to learn more or ask the candidate for an example. Do not claim an application was submitted.",
					JSON.stringify({
						company: params.company,
						title: params.title,
						roleSummary: brief.roleSummary,
						profile: params.profile,
						verifiedEvidenceMap: matchedRequirements,
						fitScore,
						recommendation
					}),
					1800
				)
			);
			return draft;
		});

		// The narrative is drafted after the match map so the score stays deterministic and explainable.
		const positioning = await step.do("write-positioning-summary", async () => {
			const summary = await generateJson(
				this.env.AI,
				"Return valid JSON only with a concise positioning field. Explain the candidate's strongest truthful angle for this role and name the main evidence gap. Do not add facts or claims.",
				JSON.stringify({
					company: params.company,
					title: params.title,
					profile: params.profile,
					fitScore,
					requirements: matchedRequirements
				}),
				500
			);
			return z
				.object({ positioning: z.string().min(1).max(700) })
				.parse(summary).positioning;
		});

		const finalAnalysis = RoleAnalysisSchema.parse({
			roleSummary: brief.roleSummary,
			positioning,
			fitScore,
			recommendation,
			requirements: matchedRequirements,
			nextMoves: kit.nextMoves,
			interviewQuestions: kit.interviewQuestions,
			coverLetter: kit.coverLetter
		});

		await this.reportProgress({
			step: "Save your review",
			status: "running",
			percent: 0.92,
			message: "Saving the evidence map and application kit to your workspace."
		});
		await step.do("save-application-review", async () => {
			await this.agent.saveAnalysis(params.applicationId, finalAnalysis);
		});

		await this.reportProgress({
			step: "Review ready",
			status: "complete",
			percent: 1,
			message:
				"Your role review is ready. Check each linked proof point before using it."
		});
		await step.reportComplete(finalAnalysis);
		return finalAnalysis;
	}
}
