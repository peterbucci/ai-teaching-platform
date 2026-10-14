# Network Performance Demo Content

This package supplies the reading, five concepts, questions, and diagnostic examples for the first Learning Pulse demonstration. The teacher reviews a prepared assignment, a student practices network-performance concepts, and the application records evidence for the teacher dashboard.

The assigned material is **section 1.5.1, Bandwidth and Latency**, from Peterson and Davie's *Computer Networks: A Systems Approach*. Its source is fixed to one Git revision so passage references remain stable.

**Status:** prepared for teacher review. The package is not yet connected to an application. Content checks establish source support and internal consistency; they do not establish educational validity or live AI reliability.

## Start here

1. Read the [assigned excerpt](reading.md).
2. Review the [concepts and question bank](REVIEW_GUIDE.md), including expected answers and acceptable alternatives.
3. Walk through the [branching diagnostic demonstration](DEMO_GUIDE.md).
4. Review [source attribution and reuse notes](ATTRIBUTION.md).

## Assignment scope

| Concept | What the learner should demonstrate |
| --- | --- |
| Bandwidth and throughput | Distinguish available link capacity from measured transfer performance. |
| Latency and RTT | Distinguish a one-way journey from a complete outward-and-return journey. |
| Transmission delay | Explain and calculate the time to place a finite packet's bits onto a link. |
| Propagation delay | Explain and calculate signal travel time from distance and propagation speed. |
| Queuing delay | Recognize waiting before forwarding and use given waiting times in the reading's simplified delay model. |

The question bank contains three questions per concept. Questions state their assumptions and refer to specific source passages. Transmission and propagation questions hold other factors fixed when changing distance, packet size or rate. RTT calculations state the outward and return delays. Queuing questions do not require advanced traffic models.

## Teacher review

Review or edit the objectives, expected reasoning, terminology and misconception categories. Confirm that the questions stay within the approved excerpt. Approval has not been simulated or granted on behalf of an instructor: `manifest.json` records `pending_teacher_review` with empty approver and approval time.

An application importing this package should hold the assignment in draft until a teacher approves it. Record the approved package version, reviewer and time. A material change to the reading, objectives or rubrics should create a new reviewed version.

## Tutoring and evidence

The prepared demonstration starts with a cable-length question. A mistaken explanation can create a tentative misconception hypothesis. A targeted follow-up may support that hypothesis, weaken it, or leave it uncertain. Corrective feedback cites the assigned passages, and a fresh retest records what the student can do immediately after feedback.

A correct response after feedback is labeled accordingly. It does not establish lasting retention, validated mastery, or permanent resolution of a misconception. Synthetic transcripts are examples for testing and rehearsal; they are not observations from real students or a live AI evaluation.

The AI evaluates language against the rubric. The application validates allowed actions, source references and state changes. The application records assistance and timing, and calculates dashboard counts from stored records. Repeated attempts by one student do not count as multiple students.

## Package files

| File | Purpose |
| --- | --- |
| `manifest.json` | Assignment metadata, source revision, hashes, review status, source cautions and allowed passages. |
| `reading-original.rst` | Exact contiguous excerpt of source lines 14 through 187. |
| `reading.md` | Readable text view with passage references; figures and captions omitted. |
| `passages.json` | Exact source passage spans, hashes and links. |
| `concepts.json` | Five objectives and controlled misconception definitions. |
| `question-bank.json` | Fifteen original questions, answer criteria, examples and citations. |
| `diagnostic-sequence.json` | Branching demonstration and synthetic expected outcomes. |
| `evidence-spec.json` | Proposed learning records and aggregation rules. |
| `verification.json` | Results of content integrity and consistency checks. |
| `upstream/` | Preserved performance source, README and license with verified Git blob hashes. |

Only the passage allowlist in `manifest.json` is assigned. The full performance file in `upstream/` includes later subsections for provenance and must not be used as additional tutor context for this assignment. The answer bank and rubrics belong on the teacher or server side; the student interface should reveal only the current prompt and authorized feedback.

## First integration milestone

Connect one student answer to a saved evidence record and a visible teacher-dashboard change. Then exercise all demonstration branches, including a follow-up that rejects a suspected misconception. Test the actual AI integration separately for ambiguous responses, unsupported requests, missing retrieval, invalid output and service failure before calling the workflow ready for demonstration.
