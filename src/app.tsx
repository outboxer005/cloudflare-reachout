import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "ai";
import {
	ArrowRightIcon,
	CheckCircleIcon,
	CircleNotchIcon,
	PaperPlaneRightIcon,
	SparkleIcon
} from "@phosphor-icons/react";
import type { CareerAgent } from "./server";
import {
	DEFAULT_CAREER_STATE,
	DEMO_ROLE,
	type CandidateProfile,
	type CareerState,
	type RoleRecord,
	type RoleReviewInput
} from "./contracts";

function getWorkspaceId() {
	const key = "rolesignal-workspace-v1";
	let id = localStorage.getItem(key);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(key, id);
	}
	return id;
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric"
	}).format(new Date(value));
}

function textFromMessage(message: UIMessage) {
	return message.parts
		.filter((part) => part.type === "text")
		.map((part) => (part.type === "text" ? part.text : ""))
		.join("");
}

function progressLabel(role: RoleRecord) {
	if (role.status === "complete") return "Review ready";
	if (role.status === "failed") return "Review paused";
	return role.progress.step;
}

function FitBadge({ strength }: { strength: "strong" | "partial" | "gap" }) {
	const label =
		strength === "strong"
			? "Evidence"
			: strength === "partial"
				? "Some signal"
				: "Gap";
	return <span className={`fit-badge fit-${strength}`}>{label}</span>;
}

function RoleResults({ role }: { role: RoleRecord }) {
	const [copied, setCopied] = useState(false);
	const analysis = role.analysis;
	if (!analysis) return null;

	const copyLetter = async () => {
		await navigator.clipboard.writeText(analysis.coverLetter);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1800);
	};

	return (
		<div className="results-stack">
			<section className="result-overview card">
				<div className="overview-copy">
					<div className="eyebrow">
						<span className="eyebrow-dot" /> YOUR ROLE REVIEW
					</div>
					<h2>
						{role.title}
						<span> at {role.company}</span>
					</h2>
					<p className="role-summary">{analysis.roleSummary}</p>
					<div
						className={`recommendation recommendation-${analysis.recommendation}`}
					>
						<span className="recommendation-mark">
							{analysis.recommendation === "strong-fit"
								? "↗"
								: analysis.recommendation === "bridge-gaps"
									? "◎"
									: "△"}
						</span>
						<div>
							<strong>
								{analysis.recommendation === "strong-fit"
									? "Lead with your strongest proof"
									: analysis.recommendation === "bridge-gaps"
										? "A credible bridge role"
										: "A stretch with clear next steps"}
							</strong>
							<p>{analysis.positioning}</p>
						</div>
					</div>
				</div>
				<div className="score-column">
					<div
						className="score-ring"
						style={
							{ "--score": `${analysis.fitScore}%` } as React.CSSProperties
						}
					>
						<div>
							<strong>{analysis.fitScore}</strong>
							<span>/ 100</span>
						</div>
					</div>
					<span className="score-caption">evidence match</span>
					<span className="score-note">A rubric, not a hiring prediction</span>
				</div>
			</section>

			<section className="card evidence-card">
				<div className="section-heading">
					<div>
						<span className="section-kicker">01 / EVIDENCE</span>
						<h3>Where your experience meets the role</h3>
					</div>
					<span className="section-count">
						{analysis.requirements.length} signals
					</span>
				</div>
				<div className="evidence-list">
					{analysis.requirements.map((item) => (
						<article className="evidence-row" key={item.id}>
							<div className="evidence-main">
								<div className="evidence-title-line">
									<h4>{item.requirement}</h4>
									<FitBadge strength={item.strength} />
								</div>
								<div className="why-matters">
									<span>ROLE SIGNAL</span> {item.whyItMatters}
								</div>
								<p>{item.rationale}</p>
								{item.evidence ? (
									<div className="proof-reference">
										<span className="proof-check">✓</span>
										<div>
											<strong>{item.evidence.title}</strong>
											<span>{item.evidence.detail}</span>
										</div>
									</div>
								) : item.skillEvidence ? (
									<div className="skill-reference">
										<span className="skill-dot" /> Skill listed:{" "}
										<strong>{item.skillEvidence}</strong> · add a concrete
										example to strengthen this signal.
									</div>
								) : (
									<div className="gap-reference">
										No matching proof point in this profile yet. Keep the gap
										visible or add a true example.
									</div>
								)}
							</div>
							<div className={`importance importance-${item.importance}`}>
								{item.importance.replace("-", " ")}
							</div>
						</article>
					))}
				</div>
			</section>

			<div className="two-up">
				<section className="card next-card">
					<div className="section-heading compact">
						<div>
							<span className="section-kicker">02 / NEXT MOVES</span>
							<h3>Make the next step count</h3>
						</div>
					</div>
					<div className="next-list">
						{analysis.nextMoves.map((move, index) => (
							<article className="next-item" key={`${move.title}-${index}`}>
								<span className="move-number">0{index + 1}</span>
								<div>
									<h4>{move.title}</h4>
									<p>{move.detail}</p>
								</div>
							</article>
						))}
					</div>
				</section>
				<section className="card interview-card">
					<div className="section-heading compact">
						<div>
							<span className="section-kicker">03 / INTERVIEW ROOM</span>
							<h3>Questions worth rehearsing</h3>
						</div>
					</div>
					<div className="question-list">
						{analysis.interviewQuestions.map((item, index) => (
							<article
								className="question-item"
								key={`${item.question}-${index}`}
							>
								<span className="question-mark">Q{index + 1}</span>
								<div>
									<h4>{item.question}</h4>
									<p>{item.angle}</p>
								</div>
							</article>
						))}
					</div>
				</section>
			</div>

			<section className="card letter-card">
				<div className="section-heading">
					<div>
						<span className="section-kicker">04 / APPLICATION DRAFT</span>
						<h3>A first-pass cover letter</h3>
					</div>
					<button type="button" className="quiet-button" onClick={copyLetter}>
						{copied ? "Copied" : "Copy draft"}
					</button>
				</div>
				<p className="letter-disclaimer">
					Review every claim and make it sound like you before using it.
				</p>
				<div className="cover-letter">{analysis.coverLetter}</div>
			</section>
			<p className="review-footnote">
				Generated from the profile and job description shown in this workspace.
				Verify the source facts before sharing any draft.
			</p>
		</div>
	);
}

function ChatMessage({ message }: { message: UIMessage }) {
	const isUser = message.role === "user";
	const text = textFromMessage(message);
	if (!text) return null;
	return (
		<div className={`chat-message ${isUser ? "chat-user" : "chat-assistant"}`}>
			<div className="message-role">{isUser ? "YOU" : "ROLESIGNAL"}</div>
			<div className="message-content">{text}</div>
		</div>
	);
}

export default function App() {
	const [workspaceId] = useState(getWorkspaceId);
	const [connected, setConnected] = useState(false);
	const [workspace, setWorkspace] = useState<CareerState>(DEFAULT_CAREER_STATE);
	const [profileDraft, setProfileDraft] = useState<CandidateProfile>(
		DEFAULT_CAREER_STATE.profile
	);
	const [roleDraft, setRoleDraft] = useState<RoleReviewInput>(DEMO_ROLE);
	const [chatInput, setChatInput] = useState("");
	const [notice, setNotice] = useState("");
	const [savingProfile, setSavingProfile] = useState(false);
	const [startingReview, setStartingReview] = useState(false);

	const onStateUpdate = useCallback((state: CareerState) => {
		setWorkspace(state);
		setProfileDraft(state.profile);
	}, []);
	const agent = useAgent<CareerAgent>({
		agent: "CareerAgent",
		name: workspaceId,
		onOpen: useCallback(() => setConnected(true), []),
		onClose: useCallback(() => setConnected(false), []),
		onStateUpdate
	});
	const { messages, sendMessage, status } = useAgentChat({
		agent,
		experimental_throttle: 100
	});
	const isStreaming = status === "streaming" || status === "submitted";
	const selectedRole = useMemo(
		() =>
			workspace.roles.find((role) => role.id === workspace.selectedRoleId) ??
			workspace.roles[0],
		[workspace.roles, workspace.selectedRoleId]
	);

	useEffect(() => {
		if (!connected) return;
		void agent.stub
			.getWorkspace()
			.then(setWorkspace)
			.catch(() =>
				setNotice("Could not load this workspace. Refresh to reconnect.")
			);
	}, [agent.stub, connected]);

	const saveProfile = async () => {
		setSavingProfile(true);
		setNotice("");
		try {
			const saved = await agent.stub.updateProfile(profileDraft);
			setProfileDraft(saved);
			setNotice("Profile saved to this workspace.");
		} catch {
			setNotice("Profile could not be saved. Check each field and try again.");
		} finally {
			setSavingProfile(false);
		}
	};

	const startReview = async (event: React.FormEvent) => {
		event.preventDefault();
		setStartingReview(true);
		setNotice("");
		try {
			await agent.stub.updateProfile(profileDraft);
			await agent.stub.startRoleReview(roleDraft);
		} catch {
			setNotice(
				"The review could not start. Check the role details and your connection, then try again."
			);
		} finally {
			setStartingReview(false);
		}
	};

	const selectRole = async (roleId: string) => {
		try {
			await agent.stub.selectRole(roleId);
		} catch {
			setNotice("Could not open that role review.");
		}
	};

	const submitChat = (event: React.FormEvent) => {
		event.preventDefault();
		if (!chatInput.trim() || !connected || isStreaming) return;
		void sendMessage({ text: chatInput.trim() });
		setChatInput("");
	};

	const setProfileField = <K extends keyof CandidateProfile>(
		key: K,
		value: CandidateProfile[K]
	) => {
		setProfileDraft((current) => ({ ...current, [key]: value }));
	};
	const setProofPoint = (
		id: string,
		field: "title" | "detail",
		value: string
	) => {
		setProfileDraft((current) => ({
			...current,
			proofPoints: current.proofPoints.map((point) =>
				point.id === id ? { ...point, [field]: value } : point
			)
		}));
	};
	const addProofPoint = () => {
		if (profileDraft.proofPoints.length >= 12) return;
		setProfileField("proofPoints", [
			...profileDraft.proofPoints,
			{
				id: crypto.randomUUID(),
				title: "New proof point",
				detail: "Add a specific action and a result you can verify."
			}
		]);
	};
	const removeProofPoint = (id: string) => {
		setProfileField(
			"proofPoints",
			profileDraft.proofPoints.filter((point) => point.id !== id)
		);
	};

	return (
		<div className="app-shell">
			<header className="topbar">
				<a className="brand" href="#top" aria-label="RoleSignal home">
					<span className="brand-mark">
						<span />
						<span />
						<span />
					</span>
					<span>
						role<span className="brand-light">signal</span>
					</span>
				</a>
				<div className="topbar-right">
					<span className="stack-tag">
						<span className="cf-mark">◈</span> Built on Cloudflare
					</span>
					<span className={`connection ${connected ? "is-online" : ""}`}>
						<span />
						{connected ? "Workspace live" : "Connecting"}
					</span>
					<button
						type="button"
						className="avatar-button"
						aria-label="Workspace profile"
					>
						{profileDraft.name.slice(0, 1).toUpperCase()}
					</button>
				</div>
			</header>

			<div className="workspace-grid" id="top">
				<aside className="left-rail">
					<div className="rail-caption">
						CURRENT BROWSER WORKSPACE <span>·</span> DEMO MODE
					</div>
					<section className="profile-card card">
						<div className="profile-heading">
							<div className="profile-avatar">
								{profileDraft.name.slice(0, 1).toUpperCase()}
							</div>
							<div>
								<span className="section-kicker">CANDIDATE PROFILE</span>
								<strong>{profileDraft.name || "Your profile"}</strong>
							</div>
						</div>
						<label className="field-label" htmlFor="candidate-name">
							Name
						</label>
						<input
							id="candidate-name"
							className="text-input"
							value={profileDraft.name}
							onChange={(event) => setProfileField("name", event.target.value)}
							maxLength={80}
						/>
						<label className="field-label" htmlFor="candidate-headline">
							Headline
						</label>
						<input
							id="candidate-headline"
							className="text-input"
							value={profileDraft.headline}
							onChange={(event) =>
								setProfileField("headline", event.target.value)
							}
							maxLength={140}
						/>
						<label className="field-label" htmlFor="candidate-skills">
							Skills <span>comma separated</span>
						</label>
						<textarea
							id="candidate-skills"
							className="text-input skill-input"
							value={profileDraft.skills.join(", ")}
							onChange={(event) =>
								setProfileField(
									"skills",
									event.target.value
										.split(",")
										.map((skill) => skill.trim())
										.filter(Boolean)
										.slice(0, 16)
								)
							}
							rows={3}
						/>
						<div className="proof-header">
							<span className="field-label">CONFIRMED PROOF POINTS</span>
							<button
								type="button"
								onClick={addProofPoint}
								disabled={profileDraft.proofPoints.length >= 12}
							>
								+ Add
							</button>
						</div>
						<div className="mini-proof-list">
							{profileDraft.proofPoints.map((point) => (
								<div className="mini-proof" key={point.id}>
									<span className="mini-proof-icon">✓</span>
									<div className="mini-proof-fields">
										<input
											aria-label="Proof point title"
											value={point.title}
											onChange={(event) =>
												setProofPoint(point.id, "title", event.target.value)
											}
											maxLength={120}
										/>
										<textarea
											aria-label="Proof point details"
											value={point.detail}
											onChange={(event) =>
												setProofPoint(point.id, "detail", event.target.value)
											}
											maxLength={500}
											rows={3}
										/>
									</div>
									<button
										className="remove-proof"
										type="button"
										onClick={() => removeProofPoint(point.id)}
										aria-label={`Remove ${point.title}`}
									>
										×
									</button>
								</div>
							))}
						</div>
						<button
							className="save-profile-button"
							type="button"
							onClick={saveProfile}
							disabled={!connected || savingProfile}
						>
							{savingProfile ? "Saving…" : "Save profile"}
							<ArrowRightIcon size={15} />
						</button>
						<div className="sample-note">
							These are fictional demo details. Replace them with claims you can
							verify. Only enter facts you are comfortable processing with
							Workers AI.
						</div>
					</section>

					<section className="role-history">
						<div className="history-heading">
							<span>RECENT ROLE REVIEWS</span>
							<span>{workspace.roles.length.toString().padStart(2, "0")}</span>
						</div>
						{workspace.roles.length === 0 ? (
							<div className="empty-history">
								Your reviews will appear here and stay with this browser
								workspace.
							</div>
						) : (
							workspace.roles.map((role) => (
								<button
									type="button"
									className={`history-item ${selectedRole?.id === role.id ? "history-selected" : ""}`}
									key={role.id}
									onClick={() => void selectRole(role.id)}
								>
									<span className={`history-status status-${role.status}`} />{" "}
									<span className="history-text">
										<strong>{role.title}</strong>
										<span>
											{role.company} · {formatDate(role.createdAt)}
										</span>
									</span>
									<span className="history-arrow">›</span>
								</button>
							))
						)}
					</section>
					<div className="rail-bottom">
						<div className="shield-mark">◈</div>
						<p>
							Evidence stays visible.
							<br />
							<strong>Advice stays yours.</strong>
						</p>
					</div>
				</aside>

				<main className="main-column">
					<section className="page-intro">
						<div className="intro-copy">
							<div className="eyebrow">
								<span className="eyebrow-dot" /> CAREER INTELLIGENCE, GROUNDED
								IN YOUR WORK
							</div>
							<h1>
								Make your next move
								<br />
								<em>with evidence.</em>
							</h1>
							<p>
								Bring a role and your real experience. Leave with a clear fit
								map, a smarter plan, and a draft that still sounds like you.
							</p>
						</div>
						<div className="intro-stamp">
							<SparkleIcon size={18} weight="fill" />
							<span>
								BUILT FOR
								<br />
								THE NEXT STEP
							</span>
						</div>
					</section>

					<section className="role-form-card card">
						<div className="form-topline">
							<div>
								<span className="section-kicker">START WITH THE ROLE</span>
								<h2>What are you aiming for?</h2>
							</div>
							<button
								type="button"
								className="demo-button"
								onClick={() => setRoleDraft(DEMO_ROLE)}
							>
								Load demo role <span>↗</span>
							</button>
						</div>
						<form onSubmit={startReview}>
							<div className="form-row">
								<label>
									Company
									<input
										className="text-input"
										value={roleDraft.company}
										onChange={(event) =>
											setRoleDraft({
												...roleDraft,
												company: event.target.value
											})
										}
										placeholder="Company name"
										maxLength={120}
										required
									/>
								</label>
								<label>
									Role title
									<input
										className="text-input"
										value={roleDraft.title}
										onChange={(event) =>
											setRoleDraft({ ...roleDraft, title: event.target.value })
										}
										placeholder="e.g. Product Engineer"
										maxLength={120}
										required
									/>
								</label>
							</div>
							<label className="description-label">
								Job description
								<textarea
									className="text-input job-description"
									value={roleDraft.description}
									onChange={(event) =>
										setRoleDraft({
											...roleDraft,
											description: event.target.value
										})
									}
									placeholder="Paste the role description to map its requirements…"
									minLength={80}
									maxLength={7000}
									required
								/>
							</label>
							<div className="form-footer">
								<span>
									<span className="input-count">
										{roleDraft.description.length}
									</span>{" "}
									/ 7,000 characters <span className="footer-dot">·</span> Role
									text is sent to Workers AI for analysis
								</span>
								<button
									type="submit"
									className="primary-button"
									disabled={
										!connected ||
										startingReview ||
										roleDraft.description.trim().length < 80
									}
								>
									{startingReview ? (
										<>
											<CircleNotchIcon className="spin" size={17} /> Starting
											review
										</>
									) : (
										<>
											Map my fit <ArrowRightIcon size={16} />
										</>
									)}
								</button>
							</div>
						</form>
						{notice && (
							<p className="notice" role="status">
								{notice}
							</p>
						)}
					</section>

					{selectedRole ? (
						<>
							{selectedRole.analysis ? (
								<RoleResults role={selectedRole} />
							) : (
								<section className="progress-card card">
									<div className="progress-orbit">
										<CircleNotchIcon
											size={22}
											className={selectedRole.status === "failed" ? "" : "spin"}
										/>
									</div>
									<div className="progress-copy">
										<span className="section-kicker">DURABLE ROLE REVIEW</span>
										<h3>{progressLabel(selectedRole)}</h3>
										<p>
											{selectedRole.progress.message ??
												"Preparing your evidence map."}
										</p>
										<div className="progress-track">
											<span
												style={{
													width: `${Math.round(selectedRole.progress.percent * 100)}%`
												}}
											/>
										</div>
										<div className="progress-meta">
											<span>Saved as it runs</span>
											<span>
												{Math.round(selectedRole.progress.percent * 100)}%
											</span>
										</div>
										{selectedRole.error && (
											<p className="notice">{selectedRole.error}</p>
										)}
									</div>
								</section>
							)}
						</>
					) : (
						<section className="empty-state card">
							<div className="empty-illustration">
								<span className="empty-sheet">
									ROLE
									<br />
									BRIEF
								</span>
								<span className="empty-spark">✳</span>
							</div>
							<span className="section-kicker">YOUR FIRST SIGNAL</span>
							<h3>A role review built around your proof.</h3>
							<p>
								Start with the sample role or paste in a position you are
								considering. RoleSignal will map each requirement back to the
								evidence in your profile.
							</p>
							<button
								type="button"
								className="text-button"
								onClick={() => setRoleDraft(DEMO_ROLE)}
							>
								Explore the sample role <ArrowRightIcon size={15} />
							</button>
						</section>
					)}

					<footer className="main-footer">
						<span>ROLESIGNAL · CAREER PREPARATION, WITH HUMAN JUDGMENT</span>
						<a
							href="https://developers.cloudflare.com/agents/"
							target="_blank"
							rel="noreferrer"
						>
							Powered by Cloudflare Agents ↗
						</a>
					</footer>
				</main>

				<aside className="chat-rail">
					<div className="chat-panel card">
						<div className="chat-header">
							<div className="chat-agent-avatar">
								<SparkleIcon size={17} weight="fill" />
							</div>
							<div className="chat-agent-title">
								<strong>Your thinking partner</strong>
								<span>
									<i /> Workers AI · Llama 3.3
								</span>
							</div>
							<span className="chat-header-menu">•••</span>
						</div>
						<div className="chat-context">
							<span className="context-indicator" />
							{selectedRole
								? `Talking about ${selectedRole.title}`
								: "Grounded in your profile"}
						</div>
						<div className="chat-scroll">
							{messages.length === 0 ? (
								<div className="chat-welcome">
									<div className="welcome-spark">
										<SparkleIcon size={19} weight="fill" />
									</div>
									<span className="section-kicker">A GOOD PLACE TO START</span>
									<h3>Let's make the story stronger.</h3>
									<p>
										Ask about a proof point, explore a role gap, or practice how
										to explain your impact.
									</p>
									<div className="prompt-suggestions">
										<button
											type="button"
											onClick={() =>
												setChatInput(
													"Which of my proof points is strongest for this role?"
												)
											}
										>
											Which proof point should I lead with?{" "}
											<ArrowRightIcon size={13} />
										</button>
										<button
											type="button"
											onClick={() =>
												setChatInput(
													"Help me turn one of my proof points into a concise interview answer."
												)
											}
										>
											Help me shape an interview answer{" "}
											<ArrowRightIcon size={13} />
										</button>
										<button
											type="button"
											onClick={() =>
												setChatInput(
													"What should I clarify before applying for this role?"
												)
											}
										>
											What should I clarify first? <ArrowRightIcon size={13} />
										</button>
									</div>
								</div>
							) : (
								<div className="chat-transcript">
									{messages.map((message) => (
										<ChatMessage key={message.id} message={message} />
									))}
									{isStreaming && (
										<div className="typing-indicator">
											<span />
											<span />
											<span />
										</div>
									)}
								</div>
							)}
						</div>
						<form className="chat-composer" onSubmit={submitChat}>
							<textarea
								value={chatInput}
								onChange={(event) => setChatInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey) {
										event.preventDefault();
										event.currentTarget.form?.requestSubmit();
									}
								}}
								placeholder={
									connected
										? "Ask RoleSignal…"
										: "Connecting to your workspace…"
								}
								rows={2}
								disabled={!connected || isStreaming}
							/>
							<div className="composer-bottom">
								<span>Grounded in your confirmed profile</span>
								<button
									type="submit"
									aria-label="Send message"
									disabled={!connected || isStreaming || !chatInput.trim()}
								>
									<PaperPlaneRightIcon size={16} />
								</button>
							</div>
						</form>
						<div className="chat-guardrail">
							<CheckCircleIcon size={13} /> Your facts stay yours. No
							applications are submitted.
						</div>
					</div>
					<div className="ai-note">
						<span className="ai-note-mark">i</span>
						<span>
							AI can miss context. Check every claim before you use it.
						</span>
					</div>
				</aside>
			</div>
		</div>
	);
}
