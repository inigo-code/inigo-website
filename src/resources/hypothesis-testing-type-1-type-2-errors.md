---
title: "Hypothesis testing: steps, p-values, and Type I and Type II errors"
seoTitle: "Hypothesis testing: p-values, Type I and Type II errors"
description: "The six steps of a hypothesis test, a worked one-sample z-test, what a p-value does and does not mean, and the four possible outcomes of every test."
related: ["/articles/quality-of-work-life-audit/"]
date: 2026-11-12
course: "research-methodology"
figure: "hypothesis-errors"
kind: "Notes"
keywords: ["hypothesis testing", "null hypothesis", "Type I error", "Type II error", "p-value", "level of significance", "power of a test", "z-test", "research methodology"]
takeaways:
  - "A hypothesis test asks whether the sample gives enough evidence to reject the **null hypothesis (H₀)**, the claim of no effect or no difference."
  - "A **Type I error** is rejecting a true H₀ (a false alarm); its probability is α, the level of significance. A **Type II error** is failing to reject a false H₀ (a missed effect); its probability is β."
  - "**Power** = 1 − β, the chance of detecting an effect that really exists. Larger samples raise power."
  - "Reject H₀ when the p-value is less than α. A p-value is **not** the probability that H₀ is true."
faq:
  - q: "What is the difference between a Type I and a Type II error?"
    a: "A Type I error is rejecting the null hypothesis when it is actually true: concluding there is an effect when there is none. A Type II error is failing to reject the null hypothesis when it is actually false: missing an effect that exists. The probability of a Type I error is the level of significance, α; the probability of a Type II error is β."
  - q: "What does a p-value mean?"
    a: "The p-value is the probability of getting a result at least as extreme as the one observed, assuming the null hypothesis is true. A small p-value means the data would be unusual if H₀ were true. It is not the probability that H₀ is true, and it does not measure how large or important the effect is."
  - q: "Which is worse, a Type I or a Type II error?"
    a: "It depends on the cost of each mistake. In a drug trial, wrongly approving an ineffective drug (Type I) may be worse, so α is set low. In screening for a serious disease, missing a real case (Type II) may be worse, so the test is designed for high power."
  - q: "How can you reduce both types of error at once?"
    a: "For a given sample size, lowering α raises β, and the other way round. The only way to reduce both at the same time is to collect more information: a larger sample, or more precise measurement."
  - q: "When do you use a one-tailed test instead of a two-tailed test?"
    a: "Use a one-tailed test only when the research question, decided before seeing the data, is about a change in one direction (for example, 'the new method increases sales'). Use a two-tailed test when any difference, in either direction, matters."
---

## What a hypothesis test does

A **hypothesis** is a testable statement about a population, for example "the average weight of a 250 g tea packet is 250 g". Because we see only a sample, we can never be certain. A **hypothesis test** is a rule for deciding whether the sample gives strong enough evidence against a claim.

- **Null hypothesis (H₀):** the claim of no effect, no difference or no change. It is assumed true until the evidence says otherwise. *Example: μ = 250 g.*
- **Alternative hypothesis (H₁):** what we conclude if we reject H₀. *Example: μ ≠ 250 g.*

The logic is like a criminal trial. The accused is presumed innocent (H₀). The court convicts only if the evidence is strong beyond reasonable doubt. "Not guilty" does not mean "proved innocent", and in the same way "do not reject H₀" does not mean "H₀ is proved true".

## The six steps

1. **State H₀ and H₁.** Decide whether the test is two-tailed (≠) or one-tailed (< or >).
2. **Choose the level of significance (α).** Usually 5% (0.05) or 1% (0.01).
3. **Choose the test statistic.** z-test for large samples or known σ; t-test for small samples with unknown σ; chi-square for frequencies and independence; F-test or ANOVA for comparing variances or several means.
4. **Find the critical value(s)** and the rejection region.
5. **Compute the test statistic** from the sample.
6. **Decide and conclude in words.** Reject H₀ if the statistic falls in the rejection region (equivalently, if the p-value < α).

### Critical values of z worth remembering

| Level of significance | Two-tailed | One-tailed |
|---|---|---|
| 10% | ±1.645 | 1.28 |
| 5% | ±1.96 | 1.645 |
| 1% | ±2.576 | 2.33 |

## Worked example: a one-sample z-test

A tea company claims its packets hold 250 g on average, with a known standard deviation of 6 g. A consumer group weighs a random sample of 36 packets and finds a mean of 247.6 g. Test the claim at the 5% level.

1. H₀: μ = 250 g. H₁: μ ≠ 250 g (two-tailed).
2. α = 0.05.
3. σ is known, so use the z-test: z = (x̄ − μ) ÷ (σ ÷ √n).
4. Critical values: ±1.96.
5. Standard error = 6 ÷ √36 = 1. z = (247.6 − 250) ÷ 1 = **−2.4**.
6. |−2.4| = 2.4 > 1.96, so **reject H₀**. The p-value is 2 × P(Z < −2.4) ≈ 2 × 0.0082 = **0.016**, which is less than 0.05.

**Conclusion in words:** at the 5% level, the sample gives significant evidence that the average packet weight differs from 250 g. Note what this does not say. It does not say the company is cheating, or that the shortfall of 2.4 g matters commercially. Statistical significance is not the same as practical importance.

Would the decision change at the 1% level? The critical value becomes ±2.576. Since 2.4 < 2.576, we would **not** reject H₀. The choice of α matters, which is why it must be fixed before looking at the data.

## The four outcomes of a test

Every test ends in one of four situations, shown in the figure above.

| | H₀ is actually true | H₀ is actually false |
|---|---|---|
| **Reject H₀** | **Type I error** (probability α) | Correct decision (probability 1 − β, the **power**) |
| **Do not reject H₀** | Correct decision (probability 1 − α) | **Type II error** (probability β) |

- A **Type I error** is a false alarm: declaring an effect that is not there. In the tea example, accusing an honest company of under-filling.
- A **Type II error** is a missed effect: failing to detect a real one. Letting a company that does under-fill go unchallenged.

### The trade-off

For a fixed sample size, making α smaller (being stricter about false alarms) makes β larger (more missed effects). You reduce both together only by gathering more information, usually a **larger sample**. Power also rises when the true effect is larger and when the data are less variable.

## Common mistakes

- Saying "we accept H₀". Say "we do not reject H₀": absence of evidence is not evidence of absence.
- Reading the p-value as the probability that H₀ is true.
- Treating p = 0.049 and p = 0.051 as opposite findings. They are nearly the same evidence.
- Choosing a one-tailed test after seeing which way the data point.
- Equating "statistically significant" with "important". Always report the size of the effect too.

## Practice questions

1. Distinguish between the null and alternative hypotheses, with examples from business research.
2. Explain Type I and Type II errors. Why can both not be reduced at the same time for a fixed sample size?
3. A sample of 64 customers spends on average ₹480 a visit. Past records show a mean of ₹500 with σ = ₹80. Test at 5% whether average spending has changed. *(Answer: z = −2.0; reject H₀ at 5%.)*
4. What is a p-value? What are its common misinterpretations?
5. Explain the steps in testing a hypothesis.
