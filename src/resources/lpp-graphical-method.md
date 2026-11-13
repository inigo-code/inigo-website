---
title: "Linear programming: formulation and the graphical method"
seoTitle: "LPP graphical method: formulation and a worked example"
description: "How to turn a business problem into an LPP and solve it graphically, with a fully worked example and practice problems."
related: ["/resources/critical-path-method/"]
date: 2026-11-06
course: "operations-research"
figure: "lpp"
kind: "Notes"
keywords: ["linear programming", "LPP graphical method", "feasible region", "corner point method", "LPP formulation", "operations research"]
takeaways:
  - "A **linear programming problem (LPP)** maximises or minimises a linear objective function subject to linear constraints and non-negativity."
  - "The **graphical method** works for two decision variables: draw each constraint, find the **feasible region**, and evaluate Z at every corner point."
  - "By the **corner-point theorem**, if an optimum exists it lies at a vertex of the feasible region."
  - "Worked example: make **9 tables and 12 chairs** for a maximum profit of **₹8,100**."
faq:
  - q: "What is the feasible region in linear programming?"
    a: "The feasible region is the set of all points that satisfy every constraint of the problem, including non-negativity. On a graph it is the area where the shaded regions of all the constraints overlap. Only points inside it, or on its boundary, are possible solutions."
  - q: "Why is the optimal solution at a corner point?"
    a: "Because the objective function is linear, its value changes steadily in one direction across the feasible region. The best value is therefore reached at the edge of the region, and in particular at a vertex. If two vertices give the same best value, every point on the edge between them is optimal."
  - q: "When can the graphical method be used?"
    a: "Only when the problem has two decision variables, because each variable needs its own axis. Problems with three or more variables are solved by the simplex method."
  - q: "What is an unbounded solution in LPP?"
    a: "An unbounded solution occurs when the feasible region is open in the direction that improves the objective, so Z can be increased without limit. It usually signals a missing constraint in the formulation."
  - q: "What is a redundant constraint?"
    a: "A redundant constraint is one that does not change the feasible region, because the other constraints already cut off everything it would. It can be removed without changing the solution."
---

## What a linear programming problem is

A **linear programming problem (LPP)** finds the best value (maximum profit or minimum cost) of a linear **objective function**, subject to linear **constraints** on limited resources. Every LPP has three parts:

1. **Decision variables:** the quantities you choose, such as units of each product (x, y).
2. **Objective function:** what you maximise or minimise, such as Z = 500x + 300y.
3. **Constraints:** the limits on resources, written as inequalities, plus the **non-negativity** condition x, y ≥ 0.

The graphical method works when there are **two** decision variables.

## Steps of the graphical method

1. Formulate the LPP.
2. Treat each constraint as an equation and draw its line, using the two intercepts.
3. Shade the side of each line that satisfies the inequality. The region satisfying all constraints is the **feasible region**.
4. Find the **corner points** (vertices) of the feasible region.
5. Evaluate Z at each corner point. The best value is the optimal solution. (By the corner-point theorem, if an optimum exists, it occurs at a vertex.)

## Worked example

A furniture unit makes **tables** and **chairs**.

| | Table | Chair | Hours available |
|---|---|---|---|
| Carpentry (hours) | 4 | 2 | 60 |
| Finishing (hours) | 2 | 3 | 54 |
| Profit (₹) | 500 | 300 | |

How many of each should it make to maximise profit?

**Formulation.** Let x = tables, y = chairs.

- Maximise **Z = 500x + 300y**
- subject to **4x + 2y ≤ 60** (carpentry)
- **2x + 3y ≤ 54** (finishing)
- **x, y ≥ 0**

**Plotting the lines.**

- 4x + 2y = 60 meets the axes at (15, 0) and (0, 30).
- 2x + 3y = 54 meets the axes at (27, 0) and (0, 18).

Both are "≤" constraints, so the feasible region lies towards the origin.

**Intersection of the two lines.** From 4x + 2y = 60, y = 30 − 2x. Substitute into 2x + 3y = 54:

2x + 3(30 − 2x) = 54 → 2x + 90 − 6x = 54 → −4x = −36 → **x = 9**, and y = 30 − 18 = **12**.

**Corner points and profit.**

| Corner point | Z = 500x + 300y |
|---|---|
| (0, 0) | ₹0 |
| (15, 0) | ₹7,500 |
| (9, 12) | **₹8,100** |
| (0, 18) | ₹5,400 |

**Answer.** Make **9 tables and 12 chairs** for a maximum profit of **₹8,100**. Both constraints are binding at this point: carpentry uses 4(9) + 2(12) = 60 hours and finishing uses 2(9) + 3(12) = 54 hours, so no capacity is left idle.

## Special cases to recognise

- **Multiple optimal solutions:** the objective line is parallel to a binding constraint, so every point on that edge is optimal.
- **Unbounded solution:** the feasible region is open in the direction that improves Z (possible in maximisation problems with "≥" constraints).
- **Infeasible problem:** the constraints have no common region.
- **Redundant constraint:** a constraint that does not affect the feasible region.

## Practice problems

1. Maximise Z = 40x + 30y subject to x + y ≤ 12, 2x + y ≤ 16, x, y ≥ 0. *(Answer: x = 4, y = 8, Z = 400.)*
2. Minimise Z = 3x + 5y subject to x + 3y ≥ 3, x + y ≥ 2, x, y ≥ 0. *(Answer: x = 1.5, y = 0.5, Z = 7.)*
3. A firm makes two products, A and B. Each unit of A needs 2 hours on machine M1 and 1 hour on M2; each unit of B needs 1 hour on M1 and 1 hour on M2. M1 is available for 40 hours and M2 for 30 hours. Profit is ₹60 per unit of A and ₹40 per unit of B. Formulate and solve. *(Answer: 10 units of A and 20 of B, Z = ₹1,400.)*

Check every answer by substituting back into the constraints.
