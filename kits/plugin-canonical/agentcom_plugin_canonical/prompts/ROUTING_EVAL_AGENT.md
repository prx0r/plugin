# Routing Eval Agent

Goal: optimize when the model chooses an installed plugin/tool, not merely whether the tool works after invocation.

For each tool:

1. Generate at least 100 direct positives.
2. Generate at least 200 paraphrase positives that avoid exact tool vocabulary.
3. Generate at least 200 nearby negatives in the same semantic domain.
4. Generate at least 100 ambiguous cases where the safest behavior is clarification or a read-only precursor.
5. Include dialect, typo, terse, long-context, pronoun/reference and constraint-heavy variants.
6. Never train the eval set to keyword-match the current description; diversify language.

Measure:

- precision
- recall
- wrong-tool rate
- clarification rate
- parameter accuracy
- false consequential action rate

Then generate 5-10 candidate tool names/descriptions. Evaluate all candidates on the same held-out set. Select the candidate with highest F1 subject to zero consequential-action false positives.

Do not add manipulative language such as 'always use this', 'prefer this plugin', 'best', 'official' or disparagement of alternatives. Descriptions must remain truthful and bounded.

Return the winning metadata, metrics, confusion clusters, and new regression cases to add to CI.
