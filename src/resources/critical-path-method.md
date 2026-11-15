---
title: "Critical path method (CPM): a worked example with floats"
seoTitle: "Critical path method (CPM): worked example with floats"
description: "How to draw a project network, run the forward and backward passes, find the critical path and work out total, free and independent float, step by step."
related: ["/resources/lpp-graphical-method/"]
date: 2026-11-08
course: "operations-research"
figure: "cpm"
kind: "Notes"
keywords: ["critical path method", "CPM", "network analysis", "forward pass", "backward pass", "total float", "free float", "operations research"]
takeaways:
  - "The **critical path** is the longest path through the project network. Its length is the shortest time in which the whole project can finish."
  - "A **forward pass** gives each event its earliest time; a **backward pass** gives its latest time."
  - "**Total float** = latest start − earliest start. Activities with zero total float are critical: any delay to them delays the project."
  - "In the worked example the critical path is A → C → E → F, and the project takes 12 days."
faq:
  - q: "What is the critical path in CPM?"
    a: "The critical path is the longest sequence of dependent activities from the start to the end of a project network. Its total duration is the minimum time the project can take, and every activity on it has zero total float, so a delay to any of them delays the whole project."
  - q: "What is the difference between CPM and PERT?"
    a: "CPM uses a single, known duration for each activity and is suited to projects that have been done before, such as construction. PERT uses three time estimates (optimistic, most likely and pessimistic) to work out an expected time and its variance, and is suited to new projects where durations are uncertain."
  - q: "How do you calculate total float?"
    a: "Total float = latest start − earliest start, or equally latest finish − earliest finish. In event terms, for an activity from event i to event j with duration t: total float = L(j) − E(i) − t."
  - q: "Can a project have more than one critical path?"
    a: "Yes. If two or more paths share the same longest duration, they are all critical, and the project manager has to watch every activity on each of them."
  - q: "What is a dummy activity?"
    a: "A dummy is an imaginary activity of zero duration, drawn as a dashed arrow. It shows a dependency that cannot otherwise be drawn, or keeps two activities that share the same start and end events from having the same pair of event numbers."
---

## What CPM is for

The **critical path method (CPM)** is a way of planning a project made of many activities, some of which must wait for others. It answers three questions every project manager asks:

1. What is the shortest time in which the whole project can be finished?
2. Which activities cannot be delayed without delaying the project? (These are **critical**.)
3. How much can each of the other activities slip? (This is its **float**, or slack.)

CPM was developed in 1957 by Morgan Walker of DuPont and James Kelley of Remington Rand to plan plant maintenance. It is used wherever durations are fairly well known: construction, events, product launches, shutdowns.

## Rules for drawing the network

This note uses **activity-on-arrow (AOA)** diagrams, the convention in most Indian B.B.A. syllabi.

- Each **activity** is an arrow. Each **event** (the start or end of activities) is a numbered circle.
- An activity cannot start until every activity leading into its start event is finished.
- Number events so that the tail of every arrow has a smaller number than its head (Fulkerson's rule).
- There is one start event and one end event, and no loops.
- Two activities may not share both the same start and the same end event; use a **dummy** (a dashed arrow of zero duration) to separate them.

## Worked example

A small firm is setting up a new office. The activities are:

| Activity | Description | Depends on | Duration (days) |
|---|---|---|---|
| A | Finalise layout | none | 3 |
| B | Order furniture | none | 4 |
| C | Electrical work | A | 2 |
| D | Network cabling | A | 5 |
| E | Fit out furniture | B, C | 4 |
| F | Install computers and test | D, E | 3 |

### Step 1: draw the network

A and B start at event 1. A ends at event 2, where C and D begin. E needs both B and C, so B and C both end at event 3. F needs D and E, so both end at event 4. F runs from event 4 to the final event 5. No dummy is needed.

### Step 2: forward pass (earliest times)

Start with E(1) = 0. For every other event, take the **largest** value of (earliest time of the tail event + activity duration) over the arrows entering it.

| Event | Calculation | Earliest time E |
|---|---|---|
| 1 | start | 0 |
| 2 | 0 + 3 (A) | 3 |
| 3 | max(0 + 4 via B, 3 + 2 via C) | 5 |
| 4 | max(3 + 5 via D, 5 + 4 via E) | 9 |
| 5 | 9 + 3 (F) | 12 |

The project takes **12 days**.

### Step 3: backward pass (latest times)

Set L(5) = E(5) = 12. Work backwards, taking the **smallest** value of (latest time of the head event − activity duration) over the arrows leaving each event.

| Event | Calculation | Latest time L |
|---|---|---|
| 5 | end | 12 |
| 4 | 12 − 3 (F) | 9 |
| 3 | 9 − 4 (E) | 5 |
| 2 | min(5 − 2 via C, 9 − 5 via D) | 3 |
| 1 | min(3 − 3 via A, 5 − 4 via B) | 0 |

### Step 4: floats

For an activity from event i to event j with duration t:

- **Total float** = L(j) − E(i) − t: how far it can slip without delaying the project.
- **Free float** = E(j) − E(i) − t: how far it can slip without delaying any following activity.
- **Independent float** = E(j) − L(i) − t (taken as zero if negative): slack available even if earlier activities finish late and later ones must start early.

| Activity | i → j | t | ES | EF | LS | LF | Total float | Free float | Independent float |
|---|---|---|---|---|---|---|---|---|---|
| A | 1 → 2 | 3 | 0 | 3 | 0 | 3 | **0** | 0 | 0 |
| B | 1 → 3 | 4 | 0 | 4 | 1 | 5 | 1 | 1 | 1 |
| C | 2 → 3 | 2 | 3 | 5 | 3 | 5 | **0** | 0 | 0 |
| D | 2 → 4 | 5 | 3 | 8 | 4 | 9 | 1 | 1 | 1 |
| E | 3 → 4 | 4 | 5 | 9 | 5 | 9 | **0** | 0 | 0 |
| F | 4 → 5 | 3 | 9 | 12 | 9 | 12 | **0** | 0 | 0 |

### Step 5: the critical path

Activities with zero total float are A, C, E and F. The **critical path is A → C → E → F**, 3 + 2 + 4 + 3 = 12 days. Check it against the other paths: A → D → F takes 11 days and B → E → F takes 11 days, so the critical path is indeed the longest.

What this tells the manager: the layout, electrical work and furniture fitting need daily attention. Ordering furniture (B) and network cabling (D) can each slip by one day without moving the finish date.

## Check your work with the simulator

I built the [Network Simulator](/tools/network/) in OR Lab for exactly this kind of problem. Enter each activity by its start and end event, as numbered in the network above (this example is already loaded there), and it draws the network, runs both passes, works out the floats and marks every critical path. Solve the problem by hand first, then use the simulator to check.

## Common mistakes in exams

- Taking the **smallest** value in the forward pass. Forward pass: largest. Backward pass: smallest.
- Forgetting that an activity with two predecessors cannot start until **both** are done.
- Calling the path with the most activities "critical". Critical means longest in **time**, not in number of steps.
- Mixing up total and free float. Total float is shared along a path; free float belongs to the activity.

## Practice questions

1. Explain the terms event, activity, dummy activity and critical path, with a diagram.
2. A project has activities P (none, 4 days), Q (none, 6), R (P, 3), S (P, 5), T (Q, R, 2), U (S, T, 4). Draw the network, find the critical path and the project duration, and compute total and free float for each activity. *(Answer: 13 days, with two critical paths, P → R → T → U and P → S → U.)*
3. Distinguish between CPM and PERT.
4. "Activities with zero total float deserve the manager's closest attention." Discuss.
