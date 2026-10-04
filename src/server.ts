import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { callable, routeAgentRequest } from "agents";
import { convertToModelMessages, pruneMessages, streamText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import {
	CandidateProfileSchema,
	CareerStateSchema,
	DEFAULT_CAREER_STATE,
	RoleAnalysisSchema,
	RoleRecordSchema,
	RoleReviewInputSchema,
	WorkflowProgressSchema,
	type CandidateProfile,
	type CareerState,
	type RoleAnalysis,
	type RoleRecord
} from "./contracts";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export class CareerAgent extends AIChatAgent<Env> {
	initialState: CareerState = DEFAULT_CAREER_STATE;
	maxPersistedMessages = 100;
	chatRecovery = true;

	@callable()
	getWorkspace() {
		return CareerStateSchema.parse(this.state);
	}

	@callable()
	selectRole(applicationId: string) {
		if (!this.state.roles.some((role) => role.id === applicationId)) {
			throw new Error("That role review is no longer in this workspace.");
		}
		this.setState({ ...this.state, selectedRoleId: applicationId });
	}

	@callable()
	updateProfile(input: CandidateProfile) {
		const profile = CandidateProfileSchema.parse(input);
		this.setState({ ...this.state, profile });
		return profile;
	}

	@callable()
	async startRoleReview(input: unknown): Promise<RoleRecord> {
		const roleInput = RoleReviewInputSchema.parse(input);
		const applicationId = crypto.randomUUID();
		const profile = CandidateProfileSchema.parse(this.state.profile);
		const role = RoleRecordSchema.parse({
			...roleInput,
			id: applicationId,
			createdAt: new Date().toISOString(),
			status: "queued",
			progress: {
				step: "Queued",
				status: "queued",
				percent: 0,
				message: "Your role review is waiting to start."
			}
		});

		this.setState({
			...this.state,
			selectedRoleId: applicationId,
			roles: [
				role,
				...this.state.roles.filter((item) => item.id !== applicationId)
			].slice(0, 12)
		});

		try {
			await this.runWorkflow(
				"APPLICATION_REVIEW",
				{ ...roleInput, applicationId, profile },
				{
					id: applicationId,
					metadata: { applicationId, company: roleInput.company }
				}
			);
		} catch {
			this.updateRole(applicationId, {
				status: "failed",
				progress: {
					step: "Could not start",
					status: "failed",
					percent: 0,
					message: "The durable review could not start. Please try again."
				},
				error: "The durable review could not start. Please try again."
			});
			throw new Error("The durable review could not start. Please try again.");
		}

		return role;
	}

	@callable()
	saveAnalysis(applicationId: string, input: RoleAnalysis) {
		const analysis = RoleAnalysisSchema.parse(input);
		this.updateRole(applicationId, {
			status: "complete",
			progress: {
				step: "Review ready",
				status: "complete",
				percent: 1,
				message: "Evidence map and application kit are ready."
			},
			analysis,
			error: undefined
		});
	}

	async onWorkflowProgress(
		_workflowName: string,
		instanceId: string,
		input: unknown
	) {
		const progress = WorkflowProgressSchema.safeParse(input);
		if (!progress.success) return;
		this.updateRole(instanceId, {
			status: progress.data.status,
			progress: progress.data
		});
	}

	async onWorkflowError(
		_workflowName: string,
		instanceId: string,
		_error: string
	) {
		const message =
			"The review stopped before it finished. Your saved profile and role are still here.";
		console.error(
			JSON.stringify({
				message: "role review workflow failed",
				applicationId: instanceId
			})
		);
		this.updateRole(instanceId, {
			status: "failed",
			progress: {
				step: "Review paused",
				status: "failed",
				percent:
					this.state.roles.find((role) => role.id === instanceId)?.progress
						.percent ?? 0,
				message
			},
			error: message
		});
	}

	async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
		const workersai = createWorkersAI({ binding: this.env.AI });
		const profile = this.state.profile;
		const selectedRole = this.state.roles.find(
			(role) => role.id === this.state.selectedRoleId
		);
		const latestAnalysis = selectedRole?.analysis;
		const profileContext = [
			`Candidate: ${profile.name} — ${profile.headline}`,
			`Skills: ${profile.skills.join(", ")}`,
			"Verified proof points:",
			...profile.proofPoints.map(
				(point) => `- [${point.id}] ${point.title}: ${point.detail}`
			)
		].join("\n");
		const roleContext = selectedRole
			? [
					`Current role: ${selectedRole.title} at ${selectedRole.company}`,
					latestAnalysis
						? `Fit score: ${latestAnalysis.fitScore}/100. ${latestAnalysis.positioning}`
						: `Review status: ${selectedRole.status}.`,
					...(latestAnalysis?.requirements
						.slice(0, 5)
						.map(
							(requirement) =>
								`- ${requirement.requirement}: ${requirement.strength}; ${requirement.evidence?.title ?? "no confirmed profile evidence"}`
						) ?? [])
				].join("\n")
			: "No role has been analyzed in this workspace yet.";

		const result = streamText({
			model: workersai(MODEL, { sessionAffinity: this.sessionAffinity }),
			system: `You are RoleSignal, a thoughtful job-application coach. Help the candidate make a clear, specific case for a role and prepare for conversations.

Use only the candidate facts below as facts. Never invent employers, titles, dates, credentials, responsibilities, or metrics. If a detail is missing, ask for it or label it as something the candidate should confirm. Separate confirmed evidence from suggestions. Do not submit applications or contact employers.

When helping with interview answers, suggest a structure and invite the candidate to add their own details. Keep advice concise, practical, and encouraging without making guarantees.

Candidate profile and confirmed evidence:
${profileContext}

Selected role context:
${roleContext}`,
			messages: pruneMessages({
				messages: await convertToModelMessages(this.messages),
				toolCalls: "before-last-2-messages",
				reasoning: "before-last-message"
			}),
			abortSignal: options?.abortSignal
		});

		return result.toUIMessageStreamResponse();
	}

	private updateRole(applicationId: string, patch: Partial<RoleRecord>) {
		const roles = this.state.roles.map((role) =>
			role.id === applicationId
				? RoleRecordSchema.parse({ ...role, ...patch })
				: role
		);
		if (roles.some((role) => role.id === applicationId)) {
			this.setState({ ...this.state, roles });
		}
	}
}

export { ApplicationReviewWorkflow } from "./workflow";

export default {
	async fetch(request: Request, env: Env) {
		return (
			(await routeAgentRequest(request, env)) ||
			new Response("Not found", { status: 404 })
		);
	}
} satisfies ExportedHandler<Env>;
