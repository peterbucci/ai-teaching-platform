# Network Performance — Demo Content Package

## About this package

This folder contains the educational material we're using for the first demonstration of our AI teaching platform.

We're starting with a short reading about computer networking. Students will work through the material with an AI tutor that asks questions, evaluates their reasoning, and adjusts its approach when they struggle.

While students practice, the system will record what they're understanding and where they might be having trouble. We can then use that information to give teachers a clearer picture of how their class is doing.

**The goal of this package is to give us a consistent set of material to build and test the tutor against.** We're not trying to support every textbook or subject just yet.

**Current status:** The content is prepared but still awaiting teacher/team approval. The tutoring application has not been connected to this package yet.

## The assigned reading

We're using Section 1.5.1, *Bandwidth and Latency*, from **Computer Networks: A Systems Approach** by Larry Peterson and Bruce Davie.

We've saved a specific version of the reading so that the content doesn't unexpectedly change while we're developing the application.

The reading is divided into **13 passages**, each with its own ID (P01–P13). This lets us connect questions and explanations to the exact material that supports them.

For example, if the AI explains why an answer is incorrect, it should be able to point back to the relevant passage instead of expecting the student to trust its explanation.

You can read the assigned material in [reading.md](reading.md).

The original excerpt is preserved in [reading-original.rst](reading-original.rst). The readable version has formatting changes, passage labels, two clearly marked project notes, and notices where figures or captions were omitted.

## What we're teaching

We've selected five concepts from the reading.

| Concept | Learning goal |
|---|---|
| Bandwidth and throughput | Understand the difference between a connection's available data rate and its actual measured performance |
| Latency and RTT | Understand one-way delay versus the time for a message to travel there and back |
| Transmission delay | Explain how packet size and transmission rate affect the time needed to transmit a packet |
| Propagation delay | Explain how distance and signal speed affect the time needed for a signal to travel |
| Queuing delay | Understand why packets sometimes wait before being forwarded |

Each concept has three prepared questions, giving us **15 questions altogether**.

The questions include expected answers, acceptable alternative explanations, and guidance for recognizing partially correct responses.

That last part matters because we're interested in what the student understands, not just whether they used the exact wording we expected.

The questions and learning objectives are available in [REVIEW_GUIDE.md](REVIEW_GUIDE.md).

## Prepared content versus generated content

The questions, answer guidance, and misconception categories in this package were prepared specifically for our demonstration. They give us examples against which we can test the AI's decisions.

For the initial prototype, the AI will evaluate student responses and choose appropriate next steps within our prepared tutoring workflow. It won't need to generate an entirely new lesson or discover misconception categories from scratch.

Eventually, we'd like the application to generate questions, expected-answer guidance, and diagnostic follow-ups automatically from teacher-approved material. It could also identify recurring misconceptions from student responses without requiring teachers to define every possible misunderstanding beforehand.

We should design the tutoring logic so it can eventually work with both prepared and AI-generated questions. However, we don't need to build those additional capabilities for the hackathon.

## How the AI would use this material

We don't want the tutor to behave like a general chatbot that can introduce anything it knows about networking.

Instead, it should work from the material the teacher approved.

A typical interaction would look something like this:

1. **Ask:** The tutor selects a question about an approved concept.
2. **Evaluate:** The student answers, and the AI compares the response with the expected reasoning and assigned reading.
3. **Investigate:** If the answer suggests a misunderstanding, the tutor may ask another question to see what's causing the problem.
4. **Explain:** The tutor provides feedback supported by the reading.
5. **Retest:** The student gets another opportunity to demonstrate understanding.
6. **Record:** The application saves what happened so the teacher can review learning patterns.

We want the AI to be careful about drawing conclusions.

For example, if a student gives an incorrect answer, that doesn't automatically tell us why. They might have misunderstood the question, made a calculation mistake, or confused two concepts.

The tutor should gather more evidence before reporting a possible misconception.

## Our first tutoring demonstration

We're starting with a student confusing **transmission delay and propagation delay**.

This works well because the two concepts sound similar, but different factors affect them.

The prepared demonstration begins with question `NP-TX-01`.

Depending on the student's response, the tutor might ask for clarification, investigate a suspected misconception, provide an explanation, or move forward.

We've included examples showing different outcomes:

- A student repeatedly demonstrates the suspected misunderstanding.
- A follow-up reveals that the original suspicion wasn't supported.
- The student's reasoning remains unclear.
- The student understands the concept from the beginning.

We also have examples of corrective feedback and fresh questions to check whether the student understood the explanation.

These paths are described in [DEMO_GUIDE.md](DEMO_GUIDE.md).

**For the hackathon, getting this one complete tutoring experience working reliably is our first priority.** We can expand the same approach to the other concepts afterward.

## How we identify misconceptions

The package includes ten predefined possible misconceptions, along with an `other_or_uncertain` category.

These are common types of reasoning errors the tutor can look for. They're not labels that should be applied automatically whenever someone answers incorrectly.

For example, a student might believe that doubling the distance between two computers doubles transmission delay.

The tutor can ask a question that changes only the distance while keeping other factors constant. The student's explanation helps us determine whether the suspected misunderstanding is supported.

If the evidence is unclear, the system should record that uncertainty rather than force a conclusion.

The misconception definitions are stored in [concepts.json](concepts.json).

## What the application needs to remember

One of the main reasons we're building this platform is to help teachers see patterns across many student interactions.

To do that, we need to save more than whether an answer was right or wrong.

For example, we want to know:

- Which question the student answered.
- What they actually said.
- Whether they received a hint or explanation.
- Which concept was being tested.
- Whether the AI identified a possible misconception.
- What evidence supported or contradicted that possibility.
- Whether the student answered a later question correctly.
- Which passages supported the AI's feedback.

This information will eventually help us create class-level insights.

The proposed details are in [evidence-spec.json](evidence-spec.json). That file describes the information we'd like to preserve, but it isn't a finalized database design.

## Files in this package

Not everyone needs to read all of these.

### For teammates reviewing the educational content

| File | What's inside |
|---|---|
| [reading.md](reading.md) | The reading students would study |
| [REVIEW_GUIDE.md](REVIEW_GUIDE.md) | Questions, expected answers, and explanation guidance |
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | Example tutoring conversations and possible outcomes |
| [ATTRIBUTION.md](ATTRIBUTION.md) | Source information, copyright, and licensing considerations |

### For developers and Codex

| File | Purpose |
|---|---|
| `manifest.json` | Identifies the assignment, approved reading scope, source version, and review status |
| `passages.json` | Connects passage IDs to their original source text |
| `concepts.json` | Defines the five concepts and possible misconception categories |
| `question-bank.json` | Contains questions, expected answers, and evaluation guidance |
| `diagnostic-sequence.json` | Describes the possible steps in the first tutoring demonstration |
| `evidence-spec.json` | Describes the learning evidence we intend to save |
| `upstream/` | Preserves the original textbook source and licensing notices |

The package also contains a Python script used to verify the content.

**Important:** The complete source file in `upstream/` is preserved for reference only. The tutor should use the 13 assigned passages listed in `manifest.json`, not unrelated textbook sections.

Expected answers and grading guidance should stay on the teacher/server side. Students should see the current question and appropriate feedback, not the answer bank.

## What still needs to be decided

The content isn't formally approved yet.

Before we treat it as ready, we need to:

1. **Review the reading and five concepts.** Make sure we're happy with the scope, terminology, and learning objectives.
2. **Review the questions and tutoring examples.** Confirm the answers are accurate and decide how much diagnostic and retest coverage we need for the first demo. Right now, the transmission/propagation sequence is the most complete.
3. **Follow the textbook's license and attribution requirements.** Its CC BY 4.0 license explicitly permits adaptations, subject to its conditions. The README's apparent inconsistency is not proof that separate permission is required. We've kept both notices and linked the supporting evidence in `ATTRIBUTION.md`, including the unconfirmed wording-carryover explanation and cautions about third-party material. We do not claim author confirmation or legal clearance.

The source review also identified a few details that may affect question evaluation, including the textbook's terminology for bandwidth and throughput, assumptions about RTT, a units typo, and some limitations in the simplified delay examples. These are documented in the review materials and source metadata.

Once the team approves the content, we should record the approved version, reviewer, and date rather than simply marking it complete without a review.

## Has the content been tested?

The package passed **automated consistency checks** covering things like source references, identifiers, calculations, and question relationships.

That's useful because it helps us catch mistakes in the content files.

However, those checks do **not** mean that:

- The AI tutor has been built.
- GPT reliably evaluates student reasoning.
- The questions have been validated through an educational study.
- The teacher dashboard works.

We'll need to test those things separately as we build the application.

The verifier can be run with:

`npm run content:check`

The check is designed to inspect the prepared package without rewriting it.

## Where we go from here

Our next development milestone is to connect this content to one functioning tutoring session.

We want to demonstrate:

**Student answers → AI evaluates → AI investigates a possible mistake → student receives feedback → student tries again → teacher sees the evidence.**

Once that works with our prepared transmission/propagation example, we'll have the foundation for extending the tutor to the remaining concepts.

The priority is to demonstrate the central idea clearly, not to build every possible feature before the hackathon.