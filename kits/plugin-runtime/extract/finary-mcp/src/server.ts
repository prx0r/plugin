import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { McpServer } from "skybridge/server";
import { z } from "zod";
import { deleteCategories, listCategories, listOwners, listTransactions, updateTransactions } from "./finary.js";

// Load .env locally. In production (Alpic) there's no file — env comes from the platform.
try {
	process.loadEnvFile();
} catch {
	/* no .env file — fine */
}

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Optional HTTP Basic Auth guarding /mcp. Unset → open (fine for local/tunnel use).
// Set MCP_BASIC_AUTH="user:pass" to require credentials when deployed publicly.
function basicAuth(req: IncomingMessage, res: ServerResponse, next: () => void) {
	const expected = process.env.MCP_BASIC_AUTH;
	if (!expected) return next();
	const [scheme, encoded] = String(req.headers.authorization ?? "").split(" ");
	if (
		scheme === "Basic" &&
		encoded &&
		safeEqual(Buffer.from(encoded, "base64").toString(), expected)
	) {
		return next();
	}
	res.statusCode = 401;
	res.setHeader("WWW-Authenticate", 'Basic realm="finary-mcp"');
	res.end("Unauthorized");
}

const server = new McpServer(
	{ name: "finary-mcp", version: "0.0.1" },
	{ capabilities: {} },
)
	.use("/mcp", basicAuth)
	.registerTool(
		{
			name: "list-transactions",
			description:
				"List Finary cashflow transactions over a date range. By default covers the whole " +
				"family (Finary's Family view, merged server-side); pass ownerId from list-owners to " +
				"scope to one member (owner/ownerId on transactions are only set then). " +
				"Dates are YYYY-MM-DD; defaults to the current month when omitted.",
			inputSchema: {
				ownerId: z
					.string()
					.optional()
					.describe("Membership id from list-owners — only that family member's accounts. Omit for all."),
				startDate: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.optional()
					.describe("Start date, YYYY-MM-DD"),
				endDate: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.optional()
					.describe("End date, YYYY-MM-DD"),
				page: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Page number for pagination"),
				perPage: z
					.number()
					.int()
					.positive()
					.max(500)
					.optional()
					.describe("Items per page (default 100)"),
				marked: z
					.boolean()
					.optional()
					.describe(
						"Filter by reconciled status: false = only unticked (à pointer), true = only ticked. Omit for all.",
					),
			},
			annotations: {
				readOnlyHint: true,
				openWorldHint: false,
				destructiveHint: false,
			},
			view: {
				component: "list-transactions",
				description: "Transactions list",
			},
		},
		async ({ ownerId, startDate, endDate, page, perPage, marked }) => {
			const p = page ?? 1;
			const pp = perPage ?? 100;
			const { transactions, hasMore } = await listTransactions({
				ownerId,
				startDate,
				endDate,
				page: p,
				perPage: pp,
				marked,
			});
			const income = transactions
				.filter((t) => t.value > 0)
				.reduce((s, t) => s + t.value, 0);
			const expenses = transactions
				.filter((t) => t.value < 0)
				.reduce((s, t) => s + t.value, 0);
			const markedCount = transactions.filter((t) => t.marked).length;
			const range =
				startDate || endDate
					? ` from ${startDate ?? "…"} to ${endDate ?? "…"}`
					: "";
			return {
				structuredContent: {
					transactions,
					count: transactions.length,
					markedCount, // "pointées" / ticked-reconciled
					totalIncome: Math.round(income * 100) / 100,
					totalExpenses: Math.round(expenses * 100) / 100,
					page: p,
					perPage: pp,
					hasMore,
					nextPage: hasMore ? p + 1 : null,
				},
				content: [
					{
						type: "text",
						text:
							`${transactions.length} transactions${range} (page ${p}). ` +
							`In: ${income.toFixed(2)}, out: ${expenses.toFixed(2)}; ${markedCount} ticked. ` +
							(hasMore
								? `A full page came back — more may exist; call again with page ${p + 1} (same dates & perPage). Totals above are for this page only.`
								: "Last page."),
					},
				],
			};
		},
	)
	.registerTool(
		{
			name: "list-owners",
			description:
				"List the family members (Finary org memberships) whose accounts appear in transactions. " +
				"Use an id as list-transactions ownerId to scope results to one member.",
			inputSchema: {},
			annotations: {
				readOnlyHint: true,
				openWorldHint: false,
				destructiveHint: false,
			},
		},
		async () => {
			const owners = await listOwners();
			return {
				structuredContent: { owners },
				content: [
					{
						type: "text",
						text: owners.map((o) => `${o.owner ?? "unknown"}: ${o.id}`).join("\n") || "No owners found.",
					},
				],
			};
		},
	)
	.registerTool(
		{
			name: "list-categories",
			description:
				"List Finary transaction categories and subcategories with their IDs. Use an ID with " +
				"update-transactions. Subcategories are the usual assignment target.",
			inputSchema: {},
			annotations: {
				readOnlyHint: true,
				openWorldHint: false,
				destructiveHint: false,
			},
		},
		async () => {
			const categories = await listCategories();
			return {
				structuredContent: { categories },
				content: [{ type: "text", text: `${categories.length} categories.` }],
			};
		},
	)
	.registerTool(
		{
			name: "delete-categories",
			description:
				"Delete custom Finary transaction categories (isCustom=true in list-categories; " +
				"built-in categories are refused). Transactions assigned to a deleted category lose " +
				"it. Irreversible — confirm with the user before deleting.",
			inputSchema: {
				categoryIds: z
					.array(z.number().int())
					.min(1)
					.max(100)
					.describe("Custom category ids to delete (from list-categories)"),
			},
			annotations: {
				readOnlyHint: false,
				openWorldHint: false,
				destructiveHint: true,
			},
		},
		async ({ categoryIds }) => {
			const results = await deleteCategories(categoryIds);
			const ok = results.filter((r) => r.ok);
			const failed = results.filter((r) => !r.ok);
			return {
				structuredContent: { results, okCount: ok.length, failCount: failed.length },
				content: [
					{
						type: "text",
						text:
							`Deleted ${ok.length}/${results.length} categor${ok.length === 1 ? "y" : "ies"}.` +
							(failed.length
								? ` Failed: ${failed.map((f) => `${f.categoryId} (${f.error})`).join("; ")}`
								: ""),
					},
				],
			};
		},
	)
	.registerTool(
		{
			name: "update-transactions",
			description:
				"Update one or more transactions in a single call: assign a category (from " +
				'list-categories), rename, tick as reconciled ("Pointer la transaction"), and/or ' +
				"include/exclude from budget analysis. Categorizing also ticks by default. " +
				"Each item needs at least one field to change. " +
				"Requests run in batches of 10; one failing item doesn't stop the others. Reversible.",
			inputSchema: {
				updates: z
					.array(
						z.object({
							transactionId: z.number().int().describe("Transaction id"),
							categoryId: z
								.number()
								.int()
								.optional()
								.describe("Category id from list-categories"),
							name: z
								.string()
								.min(1)
								.optional()
								.describe("New display name (renames the transaction)"),
							marked: z
								.boolean()
								.optional()
								.describe("Tick/untick as reconciled; defaults to true when categorizing"),
							includeInAnalysis: z
								.boolean()
								.optional()
								.describe(
									'Include (true) or exclude (false) from budget analysis ("Ajouter à l\'analyse budgétaire")',
								),
						}),
					)
					.min(1)
					.max(200)
					.describe("Transactions to update (1–200)"),
			},
			annotations: {
				readOnlyHint: false,
				openWorldHint: false,
				destructiveHint: false,
			},
		},
		async ({ updates }) => {
			const bad = updates.findIndex(
				(u) =>
					u.categoryId === undefined &&
					u.name === undefined &&
					u.marked === undefined &&
					u.includeInAnalysis === undefined,
			);
			if (bad !== -1) {
				throw new Error(
					`Update at index ${bad} (transaction ${updates[bad].transactionId}) has nothing to change — provide categoryId, name, marked, or includeInAnalysis.`,
				);
			}
			// By design: categorizing also ticks the transaction, unless the caller overrides.
			const resolved = updates.map((u) => ({
				...u,
				marked: u.marked ?? (u.categoryId !== undefined ? true : undefined),
			}));
			const results = await updateTransactions(resolved);
			const ok = results.filter((r) => r.ok);
			const failed = results.filter((r) => !r.ok);
			return {
				structuredContent: {
					results: results.map((r) => ({
						transactionId: r.transactionId,
						ok: r.ok,
						name: r.transaction?.name ?? null,
						category: r.transaction?.category ?? null,
						categoryId: r.transaction?.categoryId ?? null,
						marked: r.transaction?.marked ?? null,
						includeInAnalysis: r.transaction?.includeInAnalysis ?? null,
						error: r.error ?? null,
					})),
					okCount: ok.length,
					failCount: failed.length,
				},
				content: [
					{
						type: "text",
						text:
							`Updated ${ok.length}/${results.length} transaction(s).` +
							(failed.length
								? ` ${failed.length} failed: ${failed.map((f) => f.transactionId).join(", ")}.`
								: ""),
					},
				],
			};
		},
	);

export default await server.run();

export type AppType = typeof server;
