# Network Performance — Question Review Guide

## What is this?

This is the set of questions we’ve prepared for our first AI tutoring demo. They’re based on a short networking reading and cover **five concepts, with three questions for each**.

We want our tutor to do more than mark answers right or wrong. We want it to understand what part of a student’s explanation makes sense, notice when something is unclear, and ask a useful follow-up before concluding that a student has a misconception.

**We’re preparing the questions and expected answers ourselves for the hackathon so we can test the AI against known examples.** A real teacher shouldn’t have to do this for every chapter. In the finished product, we want the AI to generate practice from teacher-approved material and adapt questions to student responses. That automated authoring process is future work, not part of this demo.

**Current status:** Peter Bucci approved these questions and concepts for the hackathon team on October 14, 2026 at 7:30 PM ET. This records team approval; it does not establish classroom-instructor review or scientific validation. The content has passed static checks, but the AI tutor itself hasn’t been validated or demonstrated by those checks.

[Read the assigned chapter](reading.md) · [See the tutoring walkthrough](DEMO_GUIDE.md) · [Package overview](README.md) · [Source attribution](ATTRIBUTION.md)

## How to help review the questions

You don’t need a CS background to contribute. Someone familiar with networking can check the answers and calculations; other teammates can focus on whether the questions are understandable, the hints feel fair, and the feedback would genuinely help someone learn.

As you read, ask yourself:

- Is the question clear about what the student should explain or calculate?
- Would we recognize a correct explanation even if the student uses different words?
- Could a partly correct answer get useful feedback instead of a blanket “wrong”?
- Do our possible misconception categories reflect evidence in the student’s reasoning, rather than a guess?

The **question prompts, expected answers, and partial-credit guidance below are kept verbatim** from [`question-bank.json`](question-bank.json). We’ve rewritten the surrounding guide and grouped the questions to make them easier to review. That JSON file remains the detailed reference for alternative answers, examples, hints, assumptions, and machine-readable identifiers.

## How we want the AI to evaluate answers

| Outcome | What it means |
| --- | --- |
| **Correct** | The student gives the result and reasoning asked for; equivalent wording and accurate units are fine. |
| **Partially correct** | Some meaningful part is right, but an answer component or explanation is missing or mistaken. |
| **Incorrect** | The response contradicts the question’s assumptions and has no meaningful correct answer component. |
| **Uncertain** | There isn’t enough clear information to judge the answer fairly, so the AI should ask for clarification. |

A few principles apply to every question:

- **Check understanding, not memorized wording.** Use the reasoning and acceptable alternatives, not exact text matching.
- **Don’t mistake an arithmetic error for a misconception.** Record calculation and unit errors separately from conceptual mistakes.
- **Don’t guess why a student was wrong.** An explicit mistaken explanation can suggest a possible misconception; ask a diagnostic follow-up before treating it as supported. An unclear answer belongs in `other_or_uncertain`.
- **Respect the conditions given in the question.** Use 8 bits per byte, decimal Mbps, and any stated one-way/round-trip assumptions. Don’t introduce extra links, hops, traffic models, or advanced material.
- **Track whether the student received help.** A correct answer after a hint or explanation isn’t the same as independent recall, and a same-session retest doesn’t show long-term retention. Record any formulas or relationships supplied in the question itself.
- **Stay grounded in the assigned reading.** If the source doesn’t support a confident assessment, leave it uncertain and surface it for teacher review.

### A few source details that matter

The reading initially uses *bandwidth* and *throughput* loosely, then makes a more precise distinction. It also uses *latency* in more than one context, so each question needs to say whether it means one-way or round-trip delay. We’re not assessing the one-bit simplification in passage `P08`. Passage `P10` has a units typo in a large-file example, even though the 20-second numerical result is correct. For queuing, we use the reading’s simplified three-part delay model and provide the waiting times rather than making students estimate network congestion.

---

## 1. Bandwidth and throughput

A link can have a certain available data rate, while an application transfers data more slowly in practice. We want students to recognize that distinction, calculate throughput, and compare situations where waiting or transfer time matters most.

**By the end of this section, students should be able to:**

- Describe link bandwidth or data rate in bits per second and measured throughput as actual observed performance.
- Calculate an observed data-transfer rate from a stated bit count and elapsed time.
- Explain why a link's available data rate need not equal measured throughput.
- Recognize that small exchanges and large transfers can emphasize different performance limits.

**Possible misunderstandings to watch for:**

- **Treats a link's available data rate as a guarantee that an application achieves that measured rate.** (`bandwidth_guarantees_throughput`)
  - *Don’t jump to conclusions:* Using the words bandwidth and throughput interchangeably does not by itself support this hypothesis.
- **Treats data rate and elapsed delay as the same quantity, or claims that raising data rate necessarily reduces every delay component.** (`bandwidth_equals_latency`)
  - *Don’t jump to conclusions:* Bandwidth can reduce transmission time; a statement about a specific large transfer may be correct. Clarify the claim's scope.

**Limits of what we’re assessing:** Frequency-domain bandwidth in hertz is contextual reading, not an assessed objective. Do not require explanations involving unassigned transport protocols, congestion-control algorithms, or detailed overhead accounting. Application examples compare the stated conditions only; neither latency nor bandwidth always dominates.

**Relevant reading:** passages `P01`, `P03`, `P05`, `P09`, `P10`, `P11` in [reading.md](reading.md).

### NP-BW-01 — Link capacity versus actual performance

**Question for the student**

> A link can transmit at up to 12 Mbps, but a measurement shows an application's transfer rate is 7 Mbps. In the more precise distinction used in the reading, which number describes available link bandwidth and which describes measured throughput? Explain why the two numbers can differ.

**Expected answer**

12 Mbps is the available link bandwidth or data rate; 7 Mbps is the measured application throughput. The available rate does not guarantee the achieved rate; implementation or other stated system inefficiencies can make measured performance lower.

**What matters in the explanation:** Distinguish an available rate from an observed rate. Explain that practical performance need not reach the available rate.

**Reasonable alternatives:** Capacity and achieved rate are acceptable wording. Accept either vocabulary when the distinction itself is explicit; explain the source's more precise usage. An explanation of implementation inefficiency is sufficient; no named network protocol is required.

**If the answer is incomplete:** Correct labels without an explanation are partial. Correct distinction with swapped terminology should be clarified, especially because the source initially treats the words loosely. A clear assertion that both must be 12 Mbps is incorrect.

**Question assumptions:** Mbps means one million bits per second. Both figures refer to the stated link and application measurement, not frequency bandwidth in hertz.

**Possible hint:** Which number says what the link can offer, and which says what was actually observed?

**Source:** passages `P01`, `P03`, `P05` in [reading.md](reading.md).

### NP-BW-02 — Calculating throughput

**Question for the student**

> During a 5-second observation, an application transfers 20 million bits over a link whose available data rate is 10 Mbps. Calculate the observed throughput in Mbps. Does that observation establish that the link's available data rate is only your calculated value? Explain.

**Expected answer**

Observed throughput is 20 million bits / 5 seconds = 4 million bits/s = 4 Mbps. No: a measured application rate of 4 Mbps does not change the stated available link data rate of 10 Mbps.

**What matters in the explanation:** Divide the transferred bit count by elapsed time. Keep measured performance distinct from available link data rate.

**Reasonable alternatives:** 4,000,000 bits/s, 4 Mb/s, or 4 Mbps. The observation may indicate lower achieved performance without identifying its cause.

**If the answer is incomplete:** Correct division with an arithmetic slip is partial with arithmetic_error recorded. A correct 4 Mbps answer that redefines the stated link capacity as 4 Mbps is partial with a conceptual issue. Do not require an explanation of the exact cause of the gap.

**Question assumptions:** The 20 million bits is the complete count for this throughput measurement. The observation interval is exactly 5 seconds. Use decimal Mbps.

**Possible hint:** A rate compares an amount with the time taken. Then compare observed performance with the stated available rate.

**Source:** passages `P01`, `P03` in [reading.md](reading.md).

### NP-BW-03 — What would make the bigger difference?

**Question for the student**

> Consider two applications. In A, sending a tiny request and reply takes negligible transmission time compared with waiting for the round trip. In B, sending one large object takes 8 seconds, while all other delay totals 0.02 seconds. For each application, would reducing round-trip waiting or increasing the effective transfer rate offer the larger opportunity for improvement under these conditions? Explain without claiming either choice always wins.

**Expected answer**

A is dominated by round-trip waiting, so reducing that waiting offers the larger opportunity. B is dominated by the time to transfer the large object, so increasing its effective transfer rate offers the larger opportunity. The answer depends on the stated relative delay contributions and the application.

**What matters in the explanation:** Use the explicitly stated dominant contribution in A. Compare B's 8-second transfer contribution with its 0.02-second other-delay contribution. Make the conclusion conditional on the example rather than universal.

**Reasonable alternatives:** Latency-bound and bandwidth-bound are acceptable but not required terms. Accept a comment that the exact gain depends on the magnitude of an improvement, while identifying the dominant contribution.

**If the answer is incomplete:** Correctly identifying only one application is partial. Correct choices without the contribution comparison are partial. Do not require a quantitative speedup because no upgrade size is specified.

**Question assumptions:** For A, request/reply processing is negligible and the given round-trip waiting dominates. For B, 8 seconds is the transfer contribution and 0.02 seconds includes all other delay in this example. The question concerns which contribution dominates, not a guarantee for an unspecified upgrade size.

**Possible hint:** Look for the contribution that accounts for most of the elapsed time in each case.

**Remember what the question already gives away:** For application A, request/reply transmission time is explicitly negligible relative to round-trip waiting.
This means a correct application does not prove the student independently recalled that supplied information. Independently recall or derive that tiny exchanges can be dominated by round-trip waiting. This prompt instead assesses applying the supplied comparison to an improvement choice.

**Source:** passages `P09`, `P10`, `P11` in [reading.md](reading.md).

---

## 2. Latency and round-trip time

Latency is a duration. One-way latency follows a single journey; round-trip time includes the return journey too. The two directions don’t have to take equal time.

**By the end of this section, students should be able to:**

- Distinguish a stated one-way latency from a round-trip time.
- State delay in units of time rather than bits per second.
- Compute a round-trip duration from explicitly supplied forward and reverse delays under a negligible-response-processing assumption.
- Recognize when one-way information is insufficient to determine a round trip.

**Possible misunderstandings to watch for:**

- **Treats a stated one-way duration as already including the return journey.** (`rtt_equals_one_way`)
  - *Don’t jump to conclusions:* The word latency alone is ambiguous in the source; use a prompt that explicitly says one-way.
- **Assumes the reverse journey must have the same delay as the forward journey without a supporting assumption.** (`rtt_always_twice_one_way`)
  - *Don’t jump to conclusions:* Twice the one-way delay is correct when equal directional delays are explicitly assumed.

**Limits of what we’re assessing:** RTT is not universally twice a measured one-way delay; any equality of the two directions must be supplied as an assumption. Do not require clock synchronization, routing, or protocol knowledge. Latency is contextual: the source sometimes uses it generically, so identify the measurement's endpoints before scoring.

**Relevant reading:** passages `P06`, `P09`, `P12` in [reading.md](reading.md).

### NP-RTT-01 — One-way versus round trip

**Question for the student**

> An observer times one message from host A to host B. A second measurement starts when A sends a request and ends when a reply reaches A. Assume the reply is generated immediately. What does each measurement describe, and what units would you use? Explain the difference in the journeys included.

**Expected answer**

The first is one-way latency from A to B. The second is round-trip time, covering the journey to B and the reply's journey back to A. Both are measured in time units such as seconds or milliseconds.

**What matters in the explanation:** State that the first measurement includes only the outward journey. State that the second includes both outward and return journeys. Use time units.

**Reasonable alternatives:** One-way delay and round-trip delay are acceptable. Any consistent time unit is acceptable.

**If the answer is incomplete:** Correct labels with no explanation of the journeys are partial. Distinguishing the journeys but using bits/s as delay units is partial with a units/concept issue; clarify it.

**Question assumptions:** Host B generates its reply with negligible processing time. The measurement endpoints are exactly those stated.

**Possible hint:** Track where the stopwatch starts and stops. Does it include a return to A?

**Source:** passages `P06`, `P12` in [reading.md](reading.md).

### NP-RTT-02 — Different times in each direction

**Question for the student**

> A request takes 18 ms to reach a server, and its reply takes 27 ms to get back. The server replies immediately, and each stated time already includes all delay on that direction's journey. What is the round-trip time? Would doubling 18 ms give the correct RTT here? Explain.

**Expected answer**

RTT = 18 + 27 = 45 ms. Doubling 18 would assume a return delay of 18 ms, contrary to the given 27 ms.

**What matters in the explanation:** Add the explicitly given outward and return durations. Explain why equal directional delays cannot be assumed here.

**Reasonable alternatives:** 0.045 seconds is equivalent. An explanation that the two directions have different given delays is sufficient; routing explanations are not required.

**If the answer is incomplete:** 18 + 27 with a sum error is partial with arithmetic_error. 45 ms without reasoning is partial. A 36 ms answer with explicit equal-return reasoning supports a tentative rtt_always_twice_one_way hypothesis only after clarification/follow-up.

**Question assumptions:** Forward delay is 18 ms and reverse delay is 27 ms. Response processing is negligible. Do not add transmission or queue components again; the stated journey times already include them.

**Possible hint:** The round trip contains two given intervals. Use each once.

**Source:** passages `P06`, `P12` in [reading.md](reading.md).

### NP-RTT-03 — When we don't know the return time

**Question for the student**

> A message's one-way delay from A to B is 12 ms. Nothing is known about the reply's delay from B to A; reply processing is negligible. Can you determine a unique RTT? Explain what additional fact or explicit assumption would make an RTT calculation possible.

**Expected answer**

No unique RTT follows from the given information. We need the return delay, or an explicit assumption about it. If we additionally assumed an equal 12 ms return delay, then RTT would be 24 ms; that is conditional, not established by the prompt.

**What matters in the explanation:** Recognize that the return duration is missing. Name a sufficient added fact or assumption and distinguish it from known information.

**Reasonable alternatives:** RTT = 12 ms + unknown return delay is sufficient. The conditional 24 ms example is optional; correctly requesting the return delay is enough.

**If the answer is incomplete:** Saying only not enough information is partial unless the missing return delay is identified. A conditional 24 ms answer is correct if the equality assumption is explicit and the response acknowledges it is not given.

**Question assumptions:** The stated 12 ms is explicitly one-way. Response processing is negligible. No symmetry of directional delays is supplied.

**Possible hint:** Which part of the outward-and-back journey has no duration yet?

**Source:** passages `P06`, `P12` in [reading.md](reading.md).

---

## 3. Transmission delay

This measures the time it takes to put a packet’s bits onto a link. It depends on packet size and link transmission rate, not cable length by itself.

**By the end of this section, students should be able to:**

- Explain transmission delay as the time needed to place a packet's bits onto the link at its given rate.
- Use transmission delay = packet size in bits / link rate in bits per second.
- Predict the effect of changing packet size or link rate while holding other relevant quantities fixed.
- Explain why changing cable length alone changes propagation delay but not transmission delay.

**Possible misunderstandings to watch for:**

- **Claims transmission delay increases with cable length when packet size and link transmission rate remain fixed.** (`transmission_depends_on_distance`)
  - *Don’t jump to conclusions:* The student may be using transmit colloquially for total delivery; first clarify which delay they mean.
- **Treats putting packet bits onto a link and signal travel along that link as the same delay component.** (`transmission_equals_propagation`)
  - *Don’t jump to conclusions:* Equal numerical values in one example do not mean the student thinks the concepts are identical.

**Limits of what we’re assessing:** Use the stated effective transmission rate; do not substitute measured application throughput without an explicit instruction. Use a single link with stated assumptions; do not infer extra hops when cable length changes. Do not assess the source's simplifying one-bit remark in P08.

**Relevant reading:** passages `P05`, `P07`, `P08` in [reading.md](reading.md).

### NP-TX-01 — The cable gets longer

**Question for the student**

> A single cable becomes twice as long. Packet size, link transmission rate, and propagation speed stay unchanged. What happens to transmission delay and propagation delay? Explain why.

**Expected answer**

Transmission delay is unchanged because it is packet size divided by transmission rate, both fixed. Propagation delay doubles because it is cable length divided by propagation speed, and only cable length doubles.

**What matters in the explanation:** Identify packet size and transmission rate as the determinants of transmission delay. Identify cable length and propagation speed as the determinants of propagation delay. Apply the stated controlled change to both quantities.

**Reasonable alternatives:** The time to put the packet onto the cable stays the same; its signal travel time doubles. Verbal proportional reasoning is sufficient; equations are optional.

**If the answer is incomplete:** One correct effect with the other missing or wrong is partial. Both effects correct without explanation are partial and need a brief reasoning probe. If the student uses transmission to mean total delivery, clarify terminology before assigning a misconception hypothesis.

**Question assumptions:** This is a single cable with no additional switches or links introduced. Packet size, effective transmission rate, and propagation speed remain fixed. The question asks for the two named components, not a prediction of queue time or total network latency.

**Possible hint:** Write each delay as a ratio. Which ratio contains cable length?

**Source:** passages `P07`, `P08`, `P12` in [reading.md](reading.md).

### NP-TX-02 — Time to put a packet on a link

**Question for the student**

> A complete packet is 1,500 bytes long, including any overhead to be counted. It is placed onto one link at 6 Mbps. Use 8 bits per byte and 1 Mbps = 1,000,000 bits/s. What is its transmission delay in milliseconds? Show the size conversion and calculation. Is cable length needed to calculate this component? Explain why or why not.

**Expected answer**

1,500 bytes × 8 = 12,000 bits. Transmission delay = 12,000 / 6,000,000 seconds = 0.002 seconds = 2 ms. Cable length is not a variable in this transmission-delay calculation; it affects propagation instead.

**What matters in the explanation:** Convert the complete packet size from bytes to bits. Divide bits by the link rate in bits per second. Explain why distance is not needed for this component.

**Reasonable alternatives:** 0.002 s or 2,000 microseconds is numerically equivalent; prompt requests milliseconds but accept a correct alternative unit with conversion clarification. A direct calculation 12 kilobits / 6 megabits per second is acceptable if units are clear.

**If the answer is incomplete:** Correct size/rate reasoning with a conversion or arithmetic slip is partial; record that separately. 2 ms without the calculation or distance explanation is partial. Requiring cable length is evidence to clarify, not an automatic diagnosis.

**Question assumptions:** 1 byte = 8 bits; Mbps uses decimal millions. 6 Mbps is the effective rate for placing this packet's bits onto the link. Packet size already includes all overhead being counted. Calculate transmission only; do not add propagation or queue delays.

**Possible hint:** The size and rate must both use bits before you divide. Then convert seconds to milliseconds.

**Remember what the question already gives away:** 1 byte = 8 bits and 1 Mbps = 1,000,000 bits/s are supplied in the prompt.
This means a correct application does not prove the student independently recalled that supplied information. Independently recall the byte-to-bit or Mbps conversion factors. Applying the supplied factors can be assessed; remembering those factors cannot.

**Source:** passages `P07`, `P08` in [reading.md](reading.md).

### NP-TX-03 — The link becomes slower

**Question for the student**

> The same packet is sent along the same single cable twice. For the second send, the link transmission rate is halved. Cable length and signal propagation speed stay fixed, and there is no queue wait. Compare the second send's transmission delay and propagation delay with the first. Explain the two results separately.

**Expected answer**

Transmission delay doubles because the same number of bits is placed on the link at half the rate. Propagation delay stays unchanged because cable length and signal propagation speed are unchanged.

**What matters in the explanation:** Apply the inverse relationship between rate and transmission delay at fixed packet size. Keep propagation speed distinct from transmission rate.

**Reasonable alternatives:** Half as many bits each second means twice the time to place the packet on the link. Verbal reasoning is sufficient.

**If the answer is incomplete:** One correctly explained component is partial if the other is missing or wrong. Do not mark an imprecise statement about the whole delivery time as a specific propagation misconception without asking which component the student means.

**Question assumptions:** Packet size, cable length, and propagation speed are unchanged. This is one link and the specified effective transmission rate is halved. Queue wait is zero for both sends.

**Possible hint:** A rate in bits/s tells you how quickly bits are placed on the cable. Does halving it change the separately fixed signal speed in m/s?

**Source:** passages `P05`, `P07`, `P08` in [reading.md](reading.md).

---

## 4. Propagation delay

This measures how long a signal takes to travel through a link. It depends on distance and propagation speed, not directly on packet size or data rate.

**By the end of this section, students should be able to:**

- Explain propagation delay as signal travel time along a link.
- Use propagation delay = cable length / effective signal speed in that medium.
- Predict effects of changing distance or propagation speed while stating what remains fixed.
- Distinguish propagation delay from effects of packet size and link data rate on transmission delay.

**Possible misunderstandings to watch for:**

- **Claims a larger packet takes longer for a given signal to traverse the same link at the same propagation speed.** (`propagation_depends_on_packet_size`)
  - *Don’t jump to conclusions:* A larger packet can finish arriving later because transmission takes longer; that statement alone is correct.
- **Claims increasing the data rate necessarily increases the signal's travel speed along a link whose medium and propagation speed are fixed.** (`propagation_depends_on_link_rate`)
  - *Don’t jump to conclusions:* Real upgrades may change several physical properties. Diagnose only within a controlled prompt that fixes propagation speed.

**Limits of what we’re assessing:** Use the supplied signal speed; students need not memorize the medium-specific values. Propagation delay is not the time until an entire packet finishes arriving; transmission contributes to whole-packet delivery. No claims about the engineering feasibility of changing one parameter independently are assessed.

**Relevant reading:** passages `P07`, `P08`, `P12` in [reading.md](reading.md).

### NP-PROP-01 — How long the signal travels

**Question for the student**

> A signal travels along a 600 km cable at an effective propagation speed of 2.0 × 10^8 m/s. Calculate propagation delay in milliseconds and describe what interval your answer measures. Do not calculate the time to place a whole packet onto the cable.

**Expected answer**

600 km = 600,000 m. Propagation delay = 600,000 / 200,000,000 seconds = 0.003 s = 3 ms. It measures the travel time of a signal from one end of the cable to the other.

**What matters in the explanation:** Convert distance to units consistent with m/s. Divide cable length by the supplied effective propagation speed. Identify the result as signal travel time rather than whole-packet transmission time.

**Reasonable alternatives:** 0.003 seconds or 3,000 microseconds is equivalent. A consistent calculation in km/s is acceptable.

**If the answer is incomplete:** Distance/speed with a numerical or unit-conversion error is partial, not enough to infer a misconception. A correct result that is described as the time to place all packet bits onto the link is partial with a conceptual issue.

**Question assumptions:** The cable length is 600 km, not a geographic straight-line estimate. Propagation speed is uniform at the supplied value. Only propagation is requested.

**Possible hint:** Match the distance unit to meters per second, then use distance divided by speed.

**Source:** passages `P07`, `P08`, `P12` in [reading.md](reading.md).

### NP-PROP-02 — Changing propagation speed

**Question for the student**

> Two hypothetical links have the same cable length and the same transmission rate. The same packet is sent over each. Link B's effective signal propagation speed is twice Link A's. How do propagation delay and transmission delay on B compare with A? Explain using the quantities that determine each delay.

**Expected answer**

B's propagation delay is half A's because the same distance is divided by twice the signal speed. Transmission delay is the same because packet size and transmission rate are the same.

**What matters in the explanation:** Apply distance/speed to the propagation comparison. Apply size/rate to the transmission comparison. Distinguish signal speed from bit transmission rate.

**Reasonable alternatives:** A ratio of 1/2 for propagation and 1 for transmission is acceptable with explanation. No particular physical cable materials need be named.

**If the answer is incomplete:** One correct comparison is partial if the other is absent or wrong. Equating signal speed with link bit rate is a conceptual issue, but an unclear use of faster should be clarified.

**Question assumptions:** These are controlled hypothetical links; use the given independent quantities. Cable length, packet size, and link transmission rate are identical. Only signal propagation speed differs; no other delay is being compared.

**Possible hint:** The question changes a speed measured in m/s, while keeping the rate measured in bits/s fixed.

**Source:** passages `P07`, `P08` in [reading.md](reading.md).

### NP-PROP-03 — The larger packet finishes later

**Question for the student**

> A 1,000-byte packet and a 2,000-byte packet are sent separately over the same single cable at the same transmission rate. Cable length and propagation speed are fixed, with no queue wait. Compare their propagation delays and their transmission delays. Does a larger packet finishing later show that its signals propagated more slowly? Explain.

**Expected answer**

Both have the same propagation delay because the distance and signal speed are unchanged. The 2,000-byte packet has twice the transmission delay because it contains twice as many bits at the same rate. Its final bit is placed onto the cable later; the signals do not need to travel more slowly for the whole packet to finish arriving later.

**What matters in the explanation:** Keep distance/speed independent of packet size. Apply size/rate to obtain twice the transmission delay. Distinguish whole-packet arrival completion from signal travel time.

**Reasonable alternatives:** Each packet's bits take the same travel time after entering the cable, but the larger packet takes longer to enter completely. No actual milliseconds need be calculated.

**If the answer is incomplete:** Same propagation and double transmission with no explanation of arrival completion is partial. A statement that the larger packet takes longer overall can be correct; ask which component the student means before flagging a misconception.

**Question assumptions:** The stated byte counts are complete packet sizes. The packets are sent separately; they do not queue behind each other in this comparison. Cable length, transmission rate, and propagation speed are fixed. The question compares named components, not additional protocol or processing behavior.

**Possible hint:** Separate the time to put all the bits onto the cable from the travel time of a signal already on it.

**Source:** passages `P07`, `P08`, `P12` in [reading.md](reading.md).

---

## 5. Queuing delay

A packet may wait before it is forwarded. That waiting time is separate from transmitting its bits or having a signal travel through the link.

**By the end of this section, students should be able to:**

- Identify time a packet waits inside a switch before forwarding as queuing delay.
- Distinguish waiting from transmission and propagation.
- Add supplied propagation, transmission, and queue components in the source's simplified latency model.
- Find an unknown queue component from a supplied total and the other two components.

**Possible misunderstandings to watch for:**

- **Treats waiting for forwarding to begin as the same process as placing packet bits onto the outbound link.** (`queuing_equals_transmission`)
  - *Don’t jump to conclusions:* A simple summation mistake does not establish conceptual confusion. Ask the student to label the intervals.
- **Claims every packet must experience a positive queue wait even when immediate forwarding is specified.** (`queuing_is_always_present`)
  - *Don’t jump to conclusions:* The source says queue delays may occur; do not ask students to predict queue time from unstated traffic conditions.

**Limits of what we’re assessing:** Every numerical queue duration is supplied directly or follows by subtraction from supplied component totals. Do not assess queue distributions, traffic intensity, arrival rates, utilization, packet loss, or scheduling theory. The simplified three-component model is assumed in the questions; do not imply it is exhaustive for every real network.

**Relevant reading:** passages `P07`, `P08` in [reading.md](reading.md).

### NP-QUEUE-01 — Waiting before forwarding

**Question for the student**

> A packet is stored inside a switch for 4 ms before forwarding on its outbound link begins. What delay component is that waiting interval, and how is it different from transmission delay? In a separate case where forwarding can begin immediately and the stated waiting interval is 0 ms, must you still add a positive queue wait? Explain.

**Expected answer**

The 4 ms stored waiting interval is queuing delay. Transmission delay is the time to place the packet's bits onto the outbound link once transmission occurs. In the separate immediate-forwarding case, the stated queue wait is zero; a positive wait should not be invented.

**What matters in the explanation:** Identify waiting before forwarding as queuing. Distinguish waiting from placing bits onto the link. Honor the explicitly supplied zero-wait case.

**Reasonable alternatives:** Queueing and queuing are both acceptable spellings. Buffer waiting is acceptable wording. No explanation of traffic load or scheduling is required.

**If the answer is incomplete:** Naming queuing correctly but not distinguishing transmission or addressing the zero-wait case is partial. Do not require a traffic model or infer a queue duration beyond the supplied facts.

**Question assumptions:** The 4 ms interval is explicitly waiting before forwarding, not transmission or processing. The second case is separate and explicitly has zero waiting time. Do not model traffic or derive waiting from packet arrival rates.

**Possible hint:** Does the packet spend this interval waiting for forwarding to start, or being placed onto the link?

**Source:** passages `P07`, `P08` in [reading.md](reading.md).

### NP-QUEUE-02 — Adding three types of delay

**Question for the student**

> For one measured delivery, use the reading's simplified model: total latency = propagation + transmission + queue. The complete contributions for this delivery are 3 ms propagation, 2 ms transmission, and 5 ms queue waiting, with no other delay included. What is the total latency? Explain why the queue interval must be counted separately from transmission.

**Expected answer**

Total latency = 3 + 2 + 5 = 10 ms. The 5 ms represents waiting before forwarding, while the 2 ms represents transmission; both are separate supplied contributions.

**What matters in the explanation:** Add the three supplied components once each. Distinguish the queue waiting interval from the transmission interval.

**Reasonable alternatives:** 0.010 seconds is equivalent. The student can describe queue waiting and transmission in ordinary words.

**If the answer is incomplete:** Correct three-term addition with an arithmetic slip is partial with arithmetic_error. 10 ms without the requested distinction is partial. An omitted queue term is not enough to infer conceptual confusion without the student's explanation.

**Question assumptions:** The given values are the complete component contributions for this delivery, not per-hop values to multiply. The simplified three-component additive model is the intended model. All units are milliseconds and no other delay term is included.

**Possible hint:** List the three distinct intervals and add each exactly once.

**Remember what the question already gives away:** Total latency = propagation + transmission + queue.
This means a correct application does not prove the student independently recalled that supplied information. Independently recall the three-component additive latency equation. Applying the supplied equation and explaining the distinct waiting interval can still be assessed.

**Source:** passages `P07`, `P08` in [reading.md](reading.md).

### NP-QUEUE-03 — Working backward to find the wait

**Question for the student**

> Under the reading's simplified model with propagation, transmission, and queue waiting as the only components, a delivery's total latency is 14 ms. Its complete propagation contribution is 4 ms and transmission contribution is 3 ms. What queue waiting time is implied? Explain your calculation and what the result represents.

**Expected answer**

Queue = total latency - propagation - transmission = 14 - 4 - 3 = 7 ms. It represents the remaining waiting time in the model, before forwarding on outbound links.

**What matters in the explanation:** Rearrange the additive latency equation to isolate queue time. Subtract both other supplied contributions. Interpret the residual as waiting rather than transmission or signal travel.

**Reasonable alternatives:** 7 milliseconds or 0.007 seconds. Checking 4 + 3 + 7 = 14 is an acceptable equivalent demonstration.

**If the answer is incomplete:** Correct rearrangement with an arithmetic error is partial. A correct 7 ms without interpreting it is partial. If the student challenges the simplified model, acknowledge that real measurements may include other effects, then restate the explicit assumptions before scoring.

**Question assumptions:** 14 ms is the total for exactly the same delivery as the supplied component values. The three supplied/unknown components exhaust the model for this question. The unknown queue duration follows by subtraction; no queueing theory is needed.

**Possible hint:** Remove the two known contributions from the total. What kind of interval remains?

**Source:** passages `P07`, `P08` in [reading.md](reading.md).

---

## How this fits our hackathon demonstration

We’ll start with `NP-TX-01` and the prepared transmission-versus-propagation sequence. The AI may ask for clarification, investigate a suspected misconception, give feedback grounded in the reading, and ask a fresh question to check whether the explanation helped. The student’s original response, follow-up, feedback, and retest remain linked so the teacher can inspect the evidence.

That full experience is described in [DEMO_GUIDE.md](DEMO_GUIDE.md). The approved MVP scope requires one complete adaptive sequence with initial retrieval, a diagnostic follow-up, grounded corrective feedback, fresh retests, and the evidence-recording specification. The other concepts have approved questions and answer guidance; additional diagnostic paths can be added later.

## Team approval and remaining review

- **Question and answer accuracy:** The selected reading/version, five learning goals, all 15 questions, expected answers, acceptable alternatives, and misconception categories have team approval.
- **Tutor experience:** The prepared transmission/propagation demonstration has team approval. We still need to test whether the implemented AI gives useful feedback.
- **Demo coverage:** The team approved one complete transmission/propagation sequence for the hackathon MVP. The other concepts can expand later.
- **Textbook reuse:** Review [ATTRIBUTION.md](ATTRIBUTION.md) before publicly publishing adapted reading material; the source repository’s CC BY 4.0 license and README contain conflicting statements about derivative works.
- **Approval status:** Peter Bucci approved version `network-performance-v1` for the hackathon team at `2026-10-14T19:30-04:00` (October 14, 2026, 7:30 PM ET). This does not establish classroom-instructor review or scientific validation.

## A note for developers and Codex

This is the **human-readable review guide**. The application’s structured source of truth remains [`concepts.json`](concepts.json) and [`question-bank.json`](question-bank.json). Those files include full example student responses, machine-readable misconception associations, assumptions, and question hints. The exact branches for the first demonstration are in [`diagnostic-sequence.json`](diagnostic-sequence.json). Don’t expose expected answers or rubrics to students before they respond.

**What we’re aiming for:** Questions that let the tutor explore student understanding and give useful feedback, while the teacher can inspect where those judgments came from.
