# Network Performance — Demo Content

## What is this?

For our first demo, we're using a short reading about computer networking to demonstrate how our AI teaching platform would work.

The idea is pretty simple: a teacher assigns a reading, and students work through the material with an AI tutor. Instead of just telling students whether their answers are right or wrong, the tutor tries to understand where they're struggling, asks follow-up questions, and offers explanations.

The teacher can then see patterns across the class, such as concepts students are having trouble with or misconceptions that keep coming up.

This folder contains the reading, questions, and examples we're preparing for that demonstration.

**Current status:** Peter Bucci approved the prepared material for the hackathon team on October 14, 2026 at 7:30 PM ET. This records team approval; it does not establish classroom-instructor review or scientific validation. The AI tutor hasn't been implemented yet.

## Why are we preparing the questions ourselves?

For this first demo, we're preparing the questions, expected answers, and examples of common misconceptions ahead of time. That gives us a reliable way to test whether the AI is evaluating student responses correctly and asking useful follow-up questions.

This isn't how we envision teachers using the finished platform. Ideally, a teacher would just upload their assigned material, review the learning objectives suggested by the AI, and approve the assignment. The AI would then generate practice questions, adapt to students' responses, and investigate possible misunderstandings.

We're starting with prepared content so we can focus on demonstrating that the tutoring and teacher-insight features actually work. Automating content generation would come later.

## What we're teaching

We're using Section 1.5.1, _Bandwidth and Latency_, from **Computer Networks: A Systems Approach** by Larry Peterson and Bruce Davie.

The reading covers five concepts:

| Concept                  | What students should understand                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Bandwidth vs. throughput | The difference between how much data a connection can handle and how much it actually transfers |
| Latency and RTT          | The difference between one-way delay and the time for a message to travel there and back        |
| Transmission delay       | How long it takes to put a packet's bits onto a network link                                    |
| Propagation delay        | How long it takes a signal to physically travel across a connection                             |
| Queuing delay            | Why packets sometimes have to wait before being forwarded                                       |

We chose these because they're related but easy to confuse. That makes them useful for demonstrating how the AI can investigate a student's misunderstanding rather than simply marking an answer incorrect.

The package includes 13 reading passages and 15 questions, with three questions prepared for each concept.

## How the demo would work

For the first demonstration, we're focusing on a student confusing **transmission delay** with **propagation delay**.

Here's an example:

**AI:** If a network cable becomes twice as long, what happens to transmission delay and propagation delay?

**Student:** Both double because the packet has farther to travel.

The student is partly correct. Propagation delay increases, but transmission delay doesn't change when the packet size and transmission rate stay the same.

Instead of immediately concluding that the student has a misconception, the tutor asks another question to investigate their reasoning.

Depending on the response, the AI might:

1. Ask for clarification.
2. Ask another question to test a possible misunderstanding.
3. Explain the difference using the assigned reading.
4. Give a new question to see whether the explanation helped.

The system records what happened so the teacher can see whether similar mistakes are occurring across the class.

**An important distinction:** Getting a question right immediately after an explanation doesn't necessarily mean the student will remember it later. Our system should keep those results separate.

## What the team has approved and what we still need to review

### 1. Is the material appropriate?

Peter Bucci has approved the selected reading/version, five concepts, 15 questions and answer guidance, misconception categories, and prepared demonstration for the hackathon team.

Someone familiar with networking should check the technical accuracy. Other teammates can help evaluate whether the questions are understandable and whether the AI's explanations would actually be useful to students.

You don't need a computer science background to contribute to that discussion.

### 2. Do we have the questions needed for the demo?

We've prepared three approved questions per concept. Complete diagnostic and retest sequences are not required for all five concepts in this MVP.

The transmission-versus-propagation example supplies the complete prepared sequence.

The team has chosen to focus on one complete tutoring experience first; the other concepts can expand later.

The approved Issue #2 scope requires one complete adaptive sequence: initial retrieval, a diagnostic follow-up, grounded corrective feedback, fresh retests, and an evidence-recording specification. The other concepts retain approved questions and answer guidance.

### 3. Are we comfortable using this textbook?

The textbook repository's CC BY 4.0 license explicitly allows reproducing, sharing, and adapting the licensed material, subject to attribution and its other conditions. Its README contains apparently inconsistent wording about derivative works.

We've preserved the original source information and documented the inconsistency, with links to the license, README, contributor agreement, and relevant commit history in the attribution document.

The README wording is not proof that separate permission is required. We still need to follow the license conditions and check any separately credited third-party material. The possible explanation that wording was carried over from other books is unconfirmed; we are not claiming author confirmation or legal clearance.

## Where to look

You don't need to go through every file in this folder.

I'd suggest starting with these:

| Document                                                             | What it's for                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Assigned Reading](network-performance-v1/reading.md)                | The material students would study                                  |
| [Questions and Answer Guide](network-performance-v1/REVIEW_GUIDE.md) | Questions, expected answers, and what counts as a good explanation |
| [Demo Walkthrough](network-performance-v1/DEMO_GUIDE.md)             | Examples of how the AI tutoring conversation could go              |
| [Source and Attribution](network-performance-v1/ATTRIBUTION.md)      | Where the reading came from and the licensing considerations       |

For teammates who are working on the application, the package also contains structured JSON files for the concepts, questions, misconception categories, source passages, and proposed learning records.

Those files are intended to help the software use the material consistently. They aren't required reading for everyone.

## A note about accuracy

The content package has passed automated consistency checks. These check things like valid references, calculations, and whether the files agree with one another.

There are also a few textbook details reviewers should pay attention to, including how the reading uses bandwidth/throughput terminology, assumptions about one-way and round-trip delay, a source units typo, and the limited depth of the queuing section. These are documented in the package metadata and review guidance.

**Passing those checks doesn't mean the AI tutor works or that the educational approach has been validated.** We'll need to test the actual AI behavior once we implement it.

## What happens next?

With the reading and questions approved for the hackathon team, we can use this content to build the first tutoring experience.

For now, the goal is to get one complete sequence working:

**Student answers → AI investigates a possible misunderstanding → AI provides feedback → student tries again → teacher sees the results.**

After that works reliably, we can expand the demonstration to more questions and concepts.

The important thing is that we don't need to build an entire educational platform to show why the idea could be useful.
