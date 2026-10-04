import { z } from "zod";

export const ProofPointSchema = z.object({
	id: z.string().min(1).max(48),
	title: z.string().min(1).max(120),
	detail: z.string().min(1).max(500)
});

export const CandidateProfileSchema = z.object({
	name: z.string().trim().min(1).max(80),
	headline: z.string().trim().min(1).max(140),
	skills: z.array(z.string().trim().min(1).max(48)).max(16),
	proofPoints: z.array(ProofPointSchema).max(12)
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

export const RequirementFitSchema = z.object({
	id: z.string().min(1).max(48),
	requirement: z.string().min(1).max(180),
	importance: z.enum(["must-have", "important", "nice-to-have"]),
	whyItMatters: z.string().min(1).max(240),
	strength: z.enum(["strong", "partial", "gap"]),
	rationale: z.string().min(1).max(360),
	skillEvidence: z.string().max(48).nullable(),
	evidence: ProofPointSchema.nullable()
});

export const RoleAnalysisSchema = z.object({
	roleSummary: z.string().min(1).max(700),
	positioning: z.string().min(1).max(700),
	fitScore: z.number().int().min(0).max(100),
	recommendation: z.enum(["strong-fit", "bridge-gaps", "stretch"]),
	requirements: z.array(RequirementFitSchema).min(1).max(8),
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

export type RoleAnalysis = z.infer<typeof RoleAnalysisSchema>;

export const WorkflowProgressSchema = z.object({
	step: z.string().min(1).max(80),
	status: z.enum(["queued", "running", "complete", "failed"]),
	percent: z.number().min(0).max(1),
	message: z.string().max(240).optional()
});

export type WorkflowProgress = z.infer<typeof WorkflowProgressSchema>;

export const RoleRecordSchema = z.object({
	id: z.string().uuid(),
	company: z.string().min(1).max(120),
	title: z.string().min(1).max(120),
	description: z.string().min(80).max(7000),
	createdAt: z.string(),
	status: z.enum(["queued", "running", "complete", "failed"]),
	progress: WorkflowProgressSchema,
	analysis: RoleAnalysisSchema.optional(),
	error: z.string().max(240).optional()
});

export type RoleRecord = z.infer<typeof RoleRecordSchema>;

export const CareerStateSchema = z.object({
	profile: CandidateProfileSchema,
	roles: z.array(RoleRecordSchema).max(12),
	selectedRoleId: z.string().uuid().optional()
});

export type CareerState = z.infer<typeof CareerStateSchema>;

export const RoleReviewInputSchema = z.object({
	company: z.string().trim().min(1).max(120),
	title: z.string().trim().min(1).max(120),
	description: z.string().trim().min(80).max(7000)
});

export type RoleReviewInput = z.infer<typeof RoleReviewInputSchema>;

export const ApplicationReviewParamsSchema = RoleReviewInputSchema.extend({
	applicationId: z.string().uuid(),
	profile: CandidateProfileSchema
});

export type ApplicationReviewParams = z.infer<
	typeof ApplicationReviewParamsSchema
>;

export const DEFAULT_PROFILE: CandidateProfile = {
	name: "Maya Chen",
	headline: "Product Engineer · 6 years",
	skills: [
		"TypeScript",
		"React",
		"Cloudflare Workers",
		"API design",
		"SQL",
		"Product analytics",
		"Experimentation"
	],
	proofPoints: [
		{
			id: "checkout-conversion",
			title: "Raised checkout conversion 12%",
			detail:
				"Rebuilt a multi-step checkout with product, design, and engineering partners; a controlled rollout increased completed purchases by 12%."
		},
		{
			id: "api-latency",
			title: "Cut p95 API latency 38%",
			detail:
				"Profiled a high-traffic read path and replaced repeated origin lookups with edge caching, reducing p95 API latency by 38%."
		},
		{
			id: "onboarding-activation",
			title: "Improved activation 19%",
			detail:
				"Designed and measured a guided onboarding experiment across four cohorts; activation improved 19% without increasing support volume."
		},
		{
			id: "cross-functional",
			title: "Led delivery across three squads",
			detail:
				"Coordinated a checkout release across three engineering squads and partnered with product and design on scope, rollout, and measurement."
		}
	]
};

export const DEMO_ROLE: RoleReviewInput = {
	company: "Northstar Labs",
	title: "Senior Product Engineer",
	description: `Northstar Labs is building workflow software for independent businesses. We are looking for a Senior Product Engineer to own customer-facing product work from discovery through launch.

What you will do:
- Build polished, accessible product experiences with React and TypeScript.
- Partner with design and product to turn customer problems into scoped releases.
- Improve reliability and performance across APIs and edge-cached data paths.
- Use experiments and product analytics to learn whether a change helped customers.
- Write clear technical plans and help other engineers grow.

What we are looking for:
- Strong React and TypeScript experience.
- Evidence of improving a measurable product outcome.
- Experience working across frontend, APIs, and data.
- Clear communication in a collaborative team.
- Cloudflare Workers or other edge computing experience is a bonus.`
};

export const DEFAULT_CAREER_STATE: CareerState = {
	profile: DEFAULT_PROFILE,
	roles: []
};
