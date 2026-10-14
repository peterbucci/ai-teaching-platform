# Network Performance Concepts and Questions

This guide presents the five draft concepts and fifteen original questions for teacher review. All assessment support comes from the assigned subsection. Expected answers describe acceptable reasoning; equivalent accurate wording should receive credit.

**Review status:** pending teacher approval. Source checks and calculation checks do not make this an educationally validated assessment.

[Package overview](README.md) · [Assigned reading](reading.md) · [Diagnostic demonstration](DEMO_GUIDE.md)

## Scoring principles

- **allowed correctness:** correct; partially_correct; incorrect; uncertain
- **correct:** The response supplies the requested conclusions and essential reasoning. Accept equivalent wording, valid alternative units, and algebraically equivalent calculations.
- **partially correct:** At least one assessed answer component or required reasoning step is correct but another is missing or wrong. For multi-part responses, score the components first: any meaningfully correct assessed component makes a mixed joint response partially_correct, even when another component contains explicit misconception evidence. Merely restating a given fact is not a correct answer component. Record arithmetic or conversion errors separately from conceptual reasoning; a correct equation with a numerical slip can show conceptual understanding without a fully correct answer.
- **incorrect:** The interpretable response contradicts the requested concept or supplied assumptions and contains no meaningfully correct assessed answer component or required reasoning step. For mixed multi-part answers, partially_correct takes priority; preserve the incorrect component and any explicit misconception evidence within that partial result. Save the claim and explanation; do not infer a specific misconception merely from the outcome.
- **uncertain:** The response lacks enough interpretable information to judge the requested idea, or its wording admits materially different interpretations. Ask for clarification rather than inventing reasoning.
- **misconception handling:** No hypothesis is warranted from a single unexplained error, guess, missing answer, or arithmetic slip. Explicit mistaken reasoning may motivate a tentative hypothesis and a targeted diagnostic follow-up; never treat it as a confirmed belief. Evidence from a follow-up can strengthen, weaken, or dismiss it. Use other_or_uncertain when no supported controlled category fits.
- **terminology handling:** P01 uses bandwidth and throughput loosely; P03 makes a more precise distinction. Do not flag the student's vocabulary alone if their account of available versus measured rate is sound. Latency is contextual; honor a correctly stated measurement boundary.
- **numeric handling:** Use decimal kilo/mega prefixes, 8 bits per byte, and the units explicitly supplied. A number without required reasoning may earn partial credit and a clarification. Do not penalize harmless rounding. Report arithmetic, unit conversion, and concept findings separately.
- **assistance handling:** Record whether the answer was independent, after a hint, after corrective feedback, or at a delayed review, and copy the question's embedded_scaffolding into the evidence record. A supplied formula, relationship, or conversion can support application without demonstrating independent recall of the supplied content. Exclude the listed affected rubric criteria from independent-retrieval claims. An immediate correct retest is correct after feedback, not evidence of lasting retention.
- **example response handling:** Examples illustrate scoring and are not exhaustive answer matches. Do not classify only by text similarity.
- **grounding:** Use only linked assigned passages and the question's explicit assumptions. The P08 one-bit simplification is not assessed. If evidence does not support an assessment, return uncertain and request teacher review.

## Source details that affect assessment

- The source initially uses bandwidth and throughput loosely, then distinguishes link capacity from measured performance. Assess the distinction in reasoning; do not reject an otherwise correct answer for vocabulary alone.
- Specify one-way or round-trip delay. Twice one-way delay is an assumption for a symmetric example, not a universal RTT rule.
- Use finite packets and stated assumptions. Do not assess the source's one-bit simplification as an exact physical rule.
- The large-transfer source example has a units typo: use bits divided by bits per second. Its result, 20 seconds for 25 decimal MB over 10 Mbps, is correct.
- Queuing questions use explicitly supplied waiting times and the simplified delay model. Advanced queue models, multi-hop aggregation and processing delay are outside this assignment.

## Concepts for teacher approval

### Concept 1 Bandwidth and measured throughput

Identifier: `bandwidth_throughput`. Review status: `pending_teacher_review`.

- Describe link bandwidth or data rate in bits per second and measured throughput as actual observed performance.
- Calculate an observed data-transfer rate from a stated bit count and elapsed time.
- Explain why a link's available data rate need not equal measured throughput.
- Recognize that small exchanges and large transfers can emphasize different performance limits.

**Possible misconception categories**

- **bandwidth_guarantees_throughput** — Treats a link's available data rate as a guarantee that an application achieves that measured rate.
- **bandwidth_equals_latency** — Treats data rate and elapsed delay as the same quantity, or claims that raising data rate necessarily reduces every delay component.

[P01 source lines 17 to 25](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L17-L25), [P03 source lines 35 to 46](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L35-L46), [P05 source lines 56 to 70](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L56-L70), [P09 source lines 123 to 134](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L123-L134), [P10 source lines 136 to 145](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L136-L145), [P11 source lines 155 to 167](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L155-L167)

### Concept 2 Latency and round-trip time

Identifier: `latency_rtt`. Review status: `pending_teacher_review`.

- Distinguish a stated one-way latency from a round-trip time.
- State delay in units of time rather than bits per second.
- Compute a round-trip duration from explicitly supplied forward and reverse delays under a negligible-response-processing assumption.
- Recognize when one-way information is insufficient to determine a round trip.

**Possible misconception categories**

- **rtt_equals_one_way** — Treats a stated one-way duration as already including the return journey.
- **rtt_always_twice_one_way** — Assumes the reverse journey must have the same delay as the forward journey without a supporting assumption.

[P06 source lines 83 to 92](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L83-L92), [P09 source lines 123 to 134](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L123-L134), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

### Concept 3 Transmission delay

Identifier: `transmission_delay`. Review status: `pending_teacher_review`.

- Explain transmission delay as the time needed to place a packet's bits onto the link at its given rate.
- Use transmission delay = packet size in bits / link rate in bits per second.
- Predict the effect of changing packet size or link rate while holding other relevant quantities fixed.
- Explain why changing cable length alone changes propagation delay but not transmission delay.

**Possible misconception categories**

- **transmission_depends_on_distance** — Claims transmission delay increases with cable length when packet size and link transmission rate remain fixed.
- **transmission_equals_propagation** — Treats putting packet bits onto a link and signal travel along that link as the same delay component.

[P05 source lines 56 to 70](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L56-L70), [P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

### Concept 4 Propagation delay

Identifier: `propagation_delay`. Review status: `pending_teacher_review`.

- Explain propagation delay as signal travel time along a link.
- Use propagation delay = cable length / effective signal speed in that medium.
- Predict effects of changing distance or propagation speed while stating what remains fixed.
- Distinguish propagation delay from effects of packet size and link data rate on transmission delay.

**Possible misconception categories**

- **propagation_depends_on_packet_size** — Claims a larger packet takes longer for a given signal to traverse the same link at the same propagation speed.
- **propagation_depends_on_link_rate** — Claims increasing the data rate necessarily increases the signal's travel speed along a link whose medium and propagation speed are fixed.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

### Concept 5 Queuing delay and total latency

Identifier: `queuing_delay`. Review status: `pending_teacher_review`.

- Identify time a packet waits inside a switch before forwarding as queuing delay.
- Distinguish waiting from transmission and propagation.
- Add supplied propagation, transmission, and queue components in the source's simplified latency model.
- Find an unknown queue component from a supplied total and the other two components.

**Possible misconception categories**

- **queuing_equals_transmission** — Treats waiting for forwarding to begin as the same process as placing packet bits onto the outbound link.
- **queuing_is_always_present** — Claims every packet must experience a positive queue wait even when immediate forwarding is specified.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

## Question 1 Bandwidth throughput

Identifier: `NP-BW-01`.

**Prompt**

A link can transmit at up to 12 Mbps, but a measurement shows an application's transfer rate is 7 Mbps. In the more precise distinction used in the reading, which number describes available link bandwidth and which describes measured throughput? Explain why the two numbers can differ.

**Expected answer**

12 Mbps is the available link bandwidth or data rate; 7 Mbps is the measured application throughput. The available rate does not guarantee the achieved rate; implementation or other stated system inefficiencies can make measured performance lower.

**Required reasoning**

- Distinguish an available rate from an observed rate.
- Explain that practical performance need not reach the available rate.

**Acceptable alternatives**

- Capacity and achieved rate are acceptable wording.
- Accept either vocabulary when the distinction itself is explicit; explain the source's more precise usage.
- An explanation of implementation inefficiency is sufficient; no named network protocol is required.

**Partial credit**

Correct labels without an explanation are partial. Correct distinction with swapped terminology should be clarified, especially because the source initially treats the words loosely. A clear assertion that both must be 12 Mbps is incorrect.

**Assumptions**

- Mbps means one million bits per second.
- Both figures refer to the stated link and application measurement, not frequency bandwidth in hertz.

**Optional hint**

Which number says what the link can offer, and which says what was actually observed?

**Synthetic response examples**

- **correct:** 12 is available bandwidth and 7 is throughput. The application does not necessarily achieve the link's maximum, because the implementation can be inefficient.
- **partially correct:** 12 is bandwidth and 7 is throughput.
- **incorrect:** Throughput has to be 12 Mbps because the link is a 12 Mbps link; the measurement cannot be right.
- **uncertain:** They are both the speed, I guess.

**Potential hypotheses:** `bandwidth_guarantees_throughput`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P01 source lines 17 to 25](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L17-L25), [P03 source lines 35 to 46](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L35-L46), [P05 source lines 56 to 70](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L56-L70)

## Question 2 Bandwidth throughput

Identifier: `NP-BW-02`.

**Prompt**

During a 5-second observation, an application transfers 20 million bits over a link whose available data rate is 10 Mbps. Calculate the observed throughput in Mbps. Does that observation establish that the link's available data rate is only your calculated value? Explain.

**Expected answer**

Observed throughput is 20 million bits / 5 seconds = 4 million bits/s = 4 Mbps. No: a measured application rate of 4 Mbps does not change the stated available link data rate of 10 Mbps.

**Required reasoning**

- Divide the transferred bit count by elapsed time.
- Keep measured performance distinct from available link data rate.

**Acceptable alternatives**

- 4,000,000 bits/s, 4 Mb/s, or 4 Mbps.
- The observation may indicate lower achieved performance without identifying its cause.

**Partial credit**

Correct division with an arithmetic slip is partial with arithmetic_error recorded. A correct 4 Mbps answer that redefines the stated link capacity as 4 Mbps is partial with a conceptual issue. Do not require an explanation of the exact cause of the gap.

**Assumptions**

- The 20 million bits is the complete count for this throughput measurement.
- The observation interval is exactly 5 seconds.
- Use decimal Mbps.

**Optional hint**

A rate compares an amount with the time taken. Then compare observed performance with the stated available rate.

**Synthetic response examples**

- **correct:** 20/5 = 4 Mbps. That is achieved throughput; the available rate remains 10 Mbps.
- **partially correct:** 20 million divided by 5 is 4 Mbps, so the link must really only have a 4 Mbps capacity.
- **incorrect:** It is 10 Mbps because the link's stated bandwidth is always the throughput.
- **uncertain:** I would need to know what counts as a bit before I could answer.

**Potential hypotheses:** `bandwidth_guarantees_throughput`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P01 source lines 17 to 25](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L17-L25), [P03 source lines 35 to 46](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L35-L46)

## Question 3 Bandwidth throughput

Identifier: `NP-BW-03`.

**Prompt**

Consider two applications. In A, sending a tiny request and reply takes negligible transmission time compared with waiting for the round trip. In B, sending one large object takes 8 seconds, while all other delay totals 0.02 seconds. For each application, would reducing round-trip waiting or increasing the effective transfer rate offer the larger opportunity for improvement under these conditions? Explain without claiming either choice always wins.

**Expected answer**

A is dominated by round-trip waiting, so reducing that waiting offers the larger opportunity. B is dominated by the time to transfer the large object, so increasing its effective transfer rate offers the larger opportunity. The answer depends on the stated relative delay contributions and the application.

**Required reasoning**

- Use the explicitly stated dominant contribution in A.
- Compare B's 8-second transfer contribution with its 0.02-second other-delay contribution.
- Make the conclusion conditional on the example rather than universal.

**Acceptable alternatives**

- Latency-bound and bandwidth-bound are acceptable but not required terms.
- Accept a comment that the exact gain depends on the magnitude of an improvement, while identifying the dominant contribution.

**Partial credit**

Correctly identifying only one application is partial. Correct choices without the contribution comparison are partial. Do not require a quantitative speedup because no upgrade size is specified.

**Assumptions**

- For A, request/reply processing is negligible and the given round-trip waiting dominates.
- For B, 8 seconds is the transfer contribution and 0.02 seconds includes all other delay in this example.
- The question concerns which contribution dominates, not a guarantee for an unspecified upgrade size.

**Support supplied in the question**

- type: supplied_relationship; concept ids: bandwidth_throughput; latency_rtt; supplied content: For application A, request/reply transmission time is explicitly negligible relative to round-trip waiting.; affected rubric criteria: Independently recall or derive that tiny exchanges can be dominated by round-trip waiting. This prompt instead assesses applying the supplied comparison to an improvement choice.

A supplied relationship or formula cannot count as independent recall of that relationship.

**Optional hint**

Look for the contribution that accounts for most of the elapsed time in each case.

**Synthetic response examples**

- **correct:** Reduce round-trip waiting for A because sending the small messages is already negligible. Increase transfer rate for B because almost all its time is spent sending the object. Different sizes and delays could change the answer.
- **partially correct:** A needs a shorter round trip, but I am not sure about B.
- **incorrect:** Increase transfer rate for A and reduce round-trip waiting for B. Object size does not matter because bandwidth and latency are interchangeable measures.
- **uncertain:** It depends, but I cannot say what it depends on.

**Potential hypotheses:** `bandwidth_equals_latency`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P09 source lines 123 to 134](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L123-L134), [P10 source lines 136 to 145](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L136-L145), [P11 source lines 155 to 167](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L155-L167)

## Question 4 Latency rtt

Identifier: `NP-RTT-01`.

**Prompt**

An observer times one message from host A to host B. A second measurement starts when A sends a request and ends when a reply reaches A. Assume the reply is generated immediately. What does each measurement describe, and what units would you use? Explain the difference in the journeys included.

**Expected answer**

The first is one-way latency from A to B. The second is round-trip time, covering the journey to B and the reply's journey back to A. Both are measured in time units such as seconds or milliseconds.

**Required reasoning**

- State that the first measurement includes only the outward journey.
- State that the second includes both outward and return journeys.
- Use time units.

**Acceptable alternatives**

- One-way delay and round-trip delay are acceptable.
- Any consistent time unit is acceptable.

**Partial credit**

Correct labels with no explanation of the journeys are partial. Distinguishing the journeys but using bits/s as delay units is partial with a units/concept issue; clarify it.

**Assumptions**

- Host B generates its reply with negligible processing time.
- The measurement endpoints are exactly those stated.

**Optional hint**

Track where the stopwatch starts and stops. Does it include a return to A?

**Synthetic response examples**

- **correct:** A to B is one-way latency. From A out to B and back to A is RTT. Both can be measured in milliseconds.
- **partially correct:** The first is latency and the second is RTT.
- **incorrect:** The first is RTT and the second is one-way latency. RTT stops at B, while one-way latency includes the reply returning to A.
- **uncertain:** They are two kinds of speed.

**Potential hypotheses:** `rtt_equals_one_way`, `bandwidth_equals_latency`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P06 source lines 83 to 92](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L83-L92), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

## Question 5 Latency rtt

Identifier: `NP-RTT-02`.

**Prompt**

A request takes 18 ms to reach a server, and its reply takes 27 ms to get back. The server replies immediately, and each stated time already includes all delay on that direction's journey. What is the round-trip time? Would doubling 18 ms give the correct RTT here? Explain.

**Expected answer**

RTT = 18 + 27 = 45 ms. Doubling 18 would assume a return delay of 18 ms, contrary to the given 27 ms.

**Required reasoning**

- Add the explicitly given outward and return durations.
- Explain why equal directional delays cannot be assumed here.

**Acceptable alternatives**

- 0.045 seconds is equivalent.
- An explanation that the two directions have different given delays is sufficient; routing explanations are not required.

**Partial credit**

18 + 27 with a sum error is partial with arithmetic_error. 45 ms without reasoning is partial. A 36 ms answer with explicit equal-return reasoning supports a tentative rtt_always_twice_one_way hypothesis only after clarification/follow-up.

**Assumptions**

- Forward delay is 18 ms and reverse delay is 27 ms.
- Response processing is negligible.
- Do not add transmission or queue components again; the stated journey times already include them.

**Optional hint**

The round trip contains two given intervals. Use each once.

**Synthetic response examples**

- **correct:** 18 + 27 = 45 ms. Doubling 18 gives 36 ms, which wrongly makes the reverse delay equal to the forward delay.
- **partially correct:** I should add 18 and 27, so the answer is 44 ms.
- **incorrect:** 36 ms, because RTT is always two times the outward delay regardless of the return value.
- **uncertain:** I cannot tell whether 18 or 27 is the answer.

**Potential hypotheses:** `rtt_equals_one_way`, `rtt_always_twice_one_way`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P06 source lines 83 to 92](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L83-L92), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

## Question 6 Latency rtt

Identifier: `NP-RTT-03`.

**Prompt**

A message's one-way delay from A to B is 12 ms. Nothing is known about the reply's delay from B to A; reply processing is negligible. Can you determine a unique RTT? Explain what additional fact or explicit assumption would make an RTT calculation possible.

**Expected answer**

No unique RTT follows from the given information. We need the return delay, or an explicit assumption about it. If we additionally assumed an equal 12 ms return delay, then RTT would be 24 ms; that is conditional, not established by the prompt.

**Required reasoning**

- Recognize that the return duration is missing.
- Name a sufficient added fact or assumption and distinguish it from known information.

**Acceptable alternatives**

- RTT = 12 ms + unknown return delay is sufficient.
- The conditional 24 ms example is optional; correctly requesting the return delay is enough.

**Partial credit**

Saying only not enough information is partial unless the missing return delay is identified. A conditional 24 ms answer is correct if the equality assumption is explicit and the response acknowledges it is not given.

**Assumptions**

- The stated 12 ms is explicitly one-way.
- Response processing is negligible.
- No symmetry of directional delays is supplied.

**Optional hint**

Which part of the outward-and-back journey has no duration yet?

**Synthetic response examples**

- **correct:** No. We still need the B-to-A delay. If we assume it is also 12 ms, RTT would be 24 ms, but that assumption was not given.
- **partially correct:** Not enough information.
- **incorrect:** It must be 24 ms because the return is always the same as the outward trip.
- **uncertain:** Maybe 12, maybe 24; I do not know what to add.

**Potential hypotheses:** `rtt_always_twice_one_way`, `rtt_equals_one_way`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P06 source lines 83 to 92](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L83-L92), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

## Question 7 Transmission delay

Identifier: `NP-TX-01`.

**Prompt**

A single cable becomes twice as long. Packet size, link transmission rate, and propagation speed stay unchanged. What happens to transmission delay and propagation delay? Explain why.

**Expected answer**

Transmission delay is unchanged because it is packet size divided by transmission rate, both fixed. Propagation delay doubles because it is cable length divided by propagation speed, and only cable length doubles.

**Required reasoning**

- Identify packet size and transmission rate as the determinants of transmission delay.
- Identify cable length and propagation speed as the determinants of propagation delay.
- Apply the stated controlled change to both quantities.

**Acceptable alternatives**

- The time to put the packet onto the cable stays the same; its signal travel time doubles.
- Verbal proportional reasoning is sufficient; equations are optional.

**Partial credit**

One correct effect with the other missing or wrong is partial. Both effects correct without explanation are partial and need a brief reasoning probe. If the student uses transmission to mean total delivery, clarify terminology before assigning a misconception hypothesis.

**Assumptions**

- This is a single cable with no additional switches or links introduced.
- Packet size, effective transmission rate, and propagation speed remain fixed.
- The question asks for the two named components, not a prediction of queue time or total network latency.

**Optional hint**

Write each delay as a ratio. Which ratio contains cable length?

**Synthetic response examples**

- **correct:** Transmission is unchanged: the same number of bits is placed on the cable at the same rate. Propagation doubles because the signal travels twice the distance at the same speed.
- **partially correct:** Both double because transmission delay is the time the packet takes to travel the cable, so it depends on distance too.
- **incorrect:** Transmission doubles because the cable is longer, but propagation stays the same because packet size is unchanged.
- **uncertain:** It takes twice as long to send it.

**Potential hypotheses:** `transmission_depends_on_distance`, `transmission_equals_propagation`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

## Question 8 Transmission delay

Identifier: `NP-TX-02`.

**Prompt**

A complete packet is 1,500 bytes long, including any overhead to be counted. It is placed onto one link at 6 Mbps. Use 8 bits per byte and 1 Mbps = 1,000,000 bits/s. What is its transmission delay in milliseconds? Show the size conversion and calculation. Is cable length needed to calculate this component? Explain why or why not.

**Expected answer**

1,500 bytes × 8 = 12,000 bits. Transmission delay = 12,000 / 6,000,000 seconds = 0.002 seconds = 2 ms. Cable length is not a variable in this transmission-delay calculation; it affects propagation instead.

**Required reasoning**

- Convert the complete packet size from bytes to bits.
- Divide bits by the link rate in bits per second.
- Explain why distance is not needed for this component.

**Acceptable alternatives**

- 0.002 s or 2,000 microseconds is numerically equivalent; prompt requests milliseconds but accept a correct alternative unit with conversion clarification.
- A direct calculation 12 kilobits / 6 megabits per second is acceptable if units are clear.

**Partial credit**

Correct size/rate reasoning with a conversion or arithmetic slip is partial; record that separately. 2 ms without the calculation or distance explanation is partial. Requiring cable length is evidence to clarify, not an automatic diagnosis.

**Assumptions**

- 1 byte = 8 bits; Mbps uses decimal millions.
- 6 Mbps is the effective rate for placing this packet's bits onto the link.
- Packet size already includes all overhead being counted.
- Calculate transmission only; do not add propagation or queue delays.

**Support supplied in the question**

- type: unit_conversion_support; concept ids: transmission_delay; supplied content: 1 byte = 8 bits and 1 Mbps = 1,000,000 bits/s are supplied in the prompt.; affected rubric criteria: Independently recall the byte-to-bit or Mbps conversion factors. Applying the supplied factors can be assessed; remembering those factors cannot.

A supplied relationship or formula cannot count as independent recall of that relationship.

**Optional hint**

The size and rate must both use bits before you divide. Then convert seconds to milliseconds.

**Synthetic response examples**

- **correct:** 1,500 × 8 = 12,000 bits. Divide by 6,000,000 bits/s to get 0.002 s, or 2 ms. Cable length is used for propagation, not size/rate transmission time.
- **partially correct:** Transmission is size divided by rate: 1,500 / 6,000,000 = 0.25 ms. Distance is not needed.
- **incorrect:** It cannot be calculated until we know the cable length, because transmission delay is distance divided by signal speed.
- **uncertain:** Maybe 2, but I do not know the unit or why.

**Potential hypotheses:** `transmission_depends_on_distance`, `transmission_equals_propagation`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

## Question 9 Transmission delay

Identifier: `NP-TX-03`.

**Prompt**

The same packet is sent along the same single cable twice. For the second send, the link transmission rate is halved. Cable length and signal propagation speed stay fixed, and there is no queue wait. Compare the second send's transmission delay and propagation delay with the first. Explain the two results separately.

**Expected answer**

Transmission delay doubles because the same number of bits is placed on the link at half the rate. Propagation delay stays unchanged because cable length and signal propagation speed are unchanged.

**Required reasoning**

- Apply the inverse relationship between rate and transmission delay at fixed packet size.
- Keep propagation speed distinct from transmission rate.

**Acceptable alternatives**

- Half as many bits each second means twice the time to place the packet on the link.
- Verbal reasoning is sufficient.

**Partial credit**

One correctly explained component is partial if the other is missing or wrong. Do not mark an imprecise statement about the whole delivery time as a specific propagation misconception without asking which component the student means.

**Assumptions**

- Packet size, cable length, and propagation speed are unchanged.
- This is one link and the specified effective transmission rate is halved.
- Queue wait is zero for both sends.

**Optional hint**

A rate in bits/s tells you how quickly bits are placed on the cable. Does halving it change the separately fixed signal speed in m/s?

**Synthetic response examples**

- **correct:** Transmission doubles because the denominator in size/rate is halved. Propagation is unchanged because distance and signal speed are fixed.
- **partially correct:** Both double, since halving the bit rate also makes each signal travel along the cable at half the speed.
- **incorrect:** Transmission is unchanged because packet size stays the same. Propagation doubles because halving the bit rate halves signal speed.
- **uncertain:** The second send is slower, but I cannot separate the two delays.

**Potential hypotheses:** `propagation_depends_on_link_rate`, `transmission_equals_propagation`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P05 source lines 56 to 70](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L56-L70), [P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

## Question 10 Propagation delay

Identifier: `NP-PROP-01`.

**Prompt**

A signal travels along a 600 km cable at an effective propagation speed of 2.0 × 10^8 m/s. Calculate propagation delay in milliseconds and describe what interval your answer measures. Do not calculate the time to place a whole packet onto the cable.

**Expected answer**

600 km = 600,000 m. Propagation delay = 600,000 / 200,000,000 seconds = 0.003 s = 3 ms. It measures the travel time of a signal from one end of the cable to the other.

**Required reasoning**

- Convert distance to units consistent with m/s.
- Divide cable length by the supplied effective propagation speed.
- Identify the result as signal travel time rather than whole-packet transmission time.

**Acceptable alternatives**

- 0.003 seconds or 3,000 microseconds is equivalent.
- A consistent calculation in km/s is acceptable.

**Partial credit**

Distance/speed with a numerical or unit-conversion error is partial, not enough to infer a misconception. A correct result that is described as the time to place all packet bits onto the link is partial with a conceptual issue.

**Assumptions**

- The cable length is 600 km, not a geographic straight-line estimate.
- Propagation speed is uniform at the supplied value.
- Only propagation is requested.

**Optional hint**

Match the distance unit to meters per second, then use distance divided by speed.

**Synthetic response examples**

- **correct:** 600,000 / 200,000,000 = 0.003 s = 3 ms. This is how long a signal takes to travel the cable.
- **partially correct:** Use distance/speed: 600 / 200,000,000 = 0.000003 seconds.
- **incorrect:** We need packet size first because a larger packet has a larger propagation delay.
- **uncertain:** I think it is some number of milliseconds but cannot decide what to divide.

**Potential hypotheses:** `transmission_equals_propagation`, `propagation_depends_on_packet_size`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

## Question 11 Propagation delay

Identifier: `NP-PROP-02`.

**Prompt**

Two hypothetical links have the same cable length and the same transmission rate. The same packet is sent over each. Link B's effective signal propagation speed is twice Link A's. How do propagation delay and transmission delay on B compare with A? Explain using the quantities that determine each delay.

**Expected answer**

B's propagation delay is half A's because the same distance is divided by twice the signal speed. Transmission delay is the same because packet size and transmission rate are the same.

**Required reasoning**

- Apply distance/speed to the propagation comparison.
- Apply size/rate to the transmission comparison.
- Distinguish signal speed from bit transmission rate.

**Acceptable alternatives**

- A ratio of 1/2 for propagation and 1 for transmission is acceptable with explanation.
- No particular physical cable materials need be named.

**Partial credit**

One correct comparison is partial if the other is absent or wrong. Equating signal speed with link bit rate is a conceptual issue, but an unclear use of faster should be clarified.

**Assumptions**

- These are controlled hypothetical links; use the given independent quantities.
- Cable length, packet size, and link transmission rate are identical.
- Only signal propagation speed differs; no other delay is being compared.

**Optional hint**

The question changes a speed measured in m/s, while keeping the rate measured in bits/s fixed.

**Synthetic response examples**

- **correct:** B has half the propagation delay because the signal covers the same length at twice the speed. Transmission is unchanged because size and bit rate are unchanged.
- **partially correct:** Both are halved because transmission and propagation mean the same travel time.
- **incorrect:** Propagation doubles because signal speed doubles, and transmission doubles because it is the same delay as propagation.
- **uncertain:** B is faster, but I cannot say which interval changes.

**Potential hypotheses:** `transmission_equals_propagation`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

## Question 12 Propagation delay

Identifier: `NP-PROP-03`.

**Prompt**

A 1,000-byte packet and a 2,000-byte packet are sent separately over the same single cable at the same transmission rate. Cable length and propagation speed are fixed, with no queue wait. Compare their propagation delays and their transmission delays. Does a larger packet finishing later show that its signals propagated more slowly? Explain.

**Expected answer**

Both have the same propagation delay because the distance and signal speed are unchanged. The 2,000-byte packet has twice the transmission delay because it contains twice as many bits at the same rate. Its final bit is placed onto the cable later; the signals do not need to travel more slowly for the whole packet to finish arriving later.

**Required reasoning**

- Keep distance/speed independent of packet size.
- Apply size/rate to obtain twice the transmission delay.
- Distinguish whole-packet arrival completion from signal travel time.

**Acceptable alternatives**

- Each packet's bits take the same travel time after entering the cable, but the larger packet takes longer to enter completely.
- No actual milliseconds need be calculated.

**Partial credit**

Same propagation and double transmission with no explanation of arrival completion is partial. A statement that the larger packet takes longer overall can be correct; ask which component the student means before flagging a misconception.

**Assumptions**

- The stated byte counts are complete packet sizes.
- The packets are sent separately; they do not queue behind each other in this comparison.
- Cable length, transmission rate, and propagation speed are fixed.
- The question compares named components, not additional protocol or processing behavior.

**Optional hint**

Separate the time to put all the bits onto the cable from the travel time of a signal already on it.

**Synthetic response examples**

- **correct:** Propagation is equal: distance and signal speed are the same. The larger packet takes twice as long to transmit because it has twice the bits. Its last bit starts traveling later, which explains a later finish without slower propagation.
- **partially correct:** They have the same propagation delay and the larger packet has double transmission delay.
- **incorrect:** The larger packet has twice the propagation delay because twice as many bits take twice as long to travel the cable.
- **uncertain:** The larger one arrives later, but I do not know which delay that means.

**Potential hypotheses:** `propagation_depends_on_packet_size`, `transmission_equals_propagation`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121), [P12 source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

## Question 13 Queuing delay

Identifier: `NP-QUEUE-01`.

**Prompt**

A packet is stored inside a switch for 4 ms before forwarding on its outbound link begins. What delay component is that waiting interval, and how is it different from transmission delay? In a separate case where forwarding can begin immediately and the stated waiting interval is 0 ms, must you still add a positive queue wait? Explain.

**Expected answer**

The 4 ms stored waiting interval is queuing delay. Transmission delay is the time to place the packet's bits onto the outbound link once transmission occurs. In the separate immediate-forwarding case, the stated queue wait is zero; a positive wait should not be invented.

**Required reasoning**

- Identify waiting before forwarding as queuing.
- Distinguish waiting from placing bits onto the link.
- Honor the explicitly supplied zero-wait case.

**Acceptable alternatives**

- Queueing and queuing are both acceptable spellings.
- Buffer waiting is acceptable wording.
- No explanation of traffic load or scheduling is required.

**Partial credit**

Naming queuing correctly but not distinguishing transmission or addressing the zero-wait case is partial. Do not require a traffic model or infer a queue duration beyond the supplied facts.

**Assumptions**

- The 4 ms interval is explicitly waiting before forwarding, not transmission or processing.
- The second case is separate and explicitly has zero waiting time.
- Do not model traffic or derive waiting from packet arrival rates.

**Optional hint**

Does the packet spend this interval waiting for forwarding to start, or being placed onto the link?

**Synthetic response examples**

- **correct:** The 4 ms is queuing: it waits before forwarding starts. Transmission is the time to put its bits onto the link. If waiting is explicitly zero, no positive queue delay should be added.
- **partially correct:** The first interval is queuing delay because the packet is waiting.
- **incorrect:** The 4 ms is transmission delay because waiting inside a switch and sending bits onto the cable are the same process.
- **uncertain:** It is a network delay, but I cannot tell which one.

**Potential hypotheses:** `queuing_equals_transmission`, `queuing_is_always_present`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

## Question 14 Queuing delay

Identifier: `NP-QUEUE-02`.

**Prompt**

For one measured delivery, use the reading's simplified model: total latency = propagation + transmission + queue. The complete contributions for this delivery are 3 ms propagation, 2 ms transmission, and 5 ms queue waiting, with no other delay included. What is the total latency? Explain why the queue interval must be counted separately from transmission.

**Expected answer**

Total latency = 3 + 2 + 5 = 10 ms. The 5 ms represents waiting before forwarding, while the 2 ms represents transmission; both are separate supplied contributions.

**Required reasoning**

- Add the three supplied components once each.
- Distinguish the queue waiting interval from the transmission interval.

**Acceptable alternatives**

- 0.010 seconds is equivalent.
- The student can describe queue waiting and transmission in ordinary words.

**Partial credit**

Correct three-term addition with an arithmetic slip is partial with arithmetic_error. 10 ms without the requested distinction is partial. An omitted queue term is not enough to infer conceptual confusion without the student's explanation.

**Assumptions**

- The given values are the complete component contributions for this delivery, not per-hop values to multiply.
- The simplified three-component additive model is the intended model.
- All units are milliseconds and no other delay term is included.

**Support supplied in the question**

- type: supplied_formula; concept ids: queuing_delay; supplied content: Total latency = propagation + transmission + queue.; affected rubric criteria: Independently recall the three-component additive latency equation. Applying the supplied equation and explaining the distinct waiting interval can still be assessed.

A supplied relationship or formula cannot count as independent recall of that relationship.

**Optional hint**

List the three distinct intervals and add each exactly once.

**Synthetic response examples**

- **correct:** 3 + 2 + 5 = 10 ms. Queue waiting occurs before forwarding and is not already included in the 2 ms of transmission.
- **partially correct:** Add 3, 2, and 5, which I get as 9 ms. Queue is separate waiting time.
- **incorrect:** 5 ms total: 3 + 2. Queue waiting is another name for transmission, so adding 5 would count it twice.
- **uncertain:** Maybe 5 or 10; I cannot tell whether the intervals overlap in this model.

**Potential hypotheses:** `queuing_equals_transmission`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

## Question 15 Queuing delay

Identifier: `NP-QUEUE-03`.

**Prompt**

Under the reading's simplified model with propagation, transmission, and queue waiting as the only components, a delivery's total latency is 14 ms. Its complete propagation contribution is 4 ms and transmission contribution is 3 ms. What queue waiting time is implied? Explain your calculation and what the result represents.

**Expected answer**

Queue = total latency - propagation - transmission = 14 - 4 - 3 = 7 ms. It represents the remaining waiting time in the model, before forwarding on outbound links.

**Required reasoning**

- Rearrange the additive latency equation to isolate queue time.
- Subtract both other supplied contributions.
- Interpret the residual as waiting rather than transmission or signal travel.

**Acceptable alternatives**

- 7 milliseconds or 0.007 seconds.
- Checking 4 + 3 + 7 = 14 is an acceptable equivalent demonstration.

**Partial credit**

Correct rearrangement with an arithmetic error is partial. A correct 7 ms without interpreting it is partial. If the student challenges the simplified model, acknowledge that real measurements may include other effects, then restate the explicit assumptions before scoring.

**Assumptions**

- 14 ms is the total for exactly the same delivery as the supplied component values.
- The three supplied/unknown components exhaust the model for this question.
- The unknown queue duration follows by subtraction; no queueing theory is needed.

**Optional hint**

Remove the two known contributions from the total. What kind of interval remains?

**Synthetic response examples**

- **correct:** 14 - 4 - 3 = 7 ms. This is queue waiting, the component left after removing propagation and transmission.
- **partially correct:** Queue is total minus propagation minus transmission: 14 - 4 - 3 = 6 ms.
- **incorrect:** Queue is 3 ms because queue waiting and transmission delay are the same thing.
- **uncertain:** I am not sure which part of 14 ms is waiting.

**Potential hypotheses:** `queuing_equals_transmission`, `other_or_uncertain`. These are candidates requiring evidence, not automatic labels.

[P07 source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107), [P08 source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)
