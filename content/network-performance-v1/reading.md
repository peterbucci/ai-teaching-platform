# Network Performance Reading

Assigned excerpt from **Computer Networks: A Systems Approach**, Larry Peterson and Bruce Davie, section 1.5.1, **Bandwidth and Latency**. Copyright Elsevier, 2012. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

[Fixed source version](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L14-L187). [Attribution and reuse notes](ATTRIBUTION.md).

This text view preserves the excerpt wording while reflowing paragraphs and displaying source markup. Figure images and captions are omitted and marked below. The exact source excerpt is available in [reading-original.rst](reading-original.rst). Passage labels and headings are navigation added for this demo. Two separately labeled project notes identify a source simplification and a units typo.

## P01 Bandwidth and bit transmission time

Network performance is measured in two fundamental ways: *bandwidth* (also called *throughput*) and *latency* (also called *delay*). The bandwidth of a network is given by the number of bits that can be transmitted over the network in a certain period of time. For example, a network might have a bandwidth of 10 million bits/second (Mbps), meaning that it is able to deliver 10 million bits every second. It is sometimes useful to think of bandwidth in terms of how long it takes to transmit each bit of data. On a 10-Mbps network, for example, it takes 0.1 microsecond (μs) to transmit each bit.

[Source lines 17 to 25](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L17-L25)

## P02 Bandwidth terminology

Bandwidth and throughput are subtly different terms. First of all, bandwidth is literally a measure of the width of a frequency band. For example, legacy voice-grade telephone lines supported a frequency band ranging from 300 to 3300 Hz; it was said to have a bandwidth of 3300 Hz - 300 Hz = 3000 Hz. If you see the word *bandwidth* used in a situation in which it is being measured in hertz, then it probably refers to the range of signals that can be accommodated.

[Source lines 27 to 33](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L27-L33)

## P03 Available data rate and measured throughput

When we talk about the bandwidth of a communication link, we normally refer to the number of bits per second that can be transmitted on the link. This is also sometimes called the *data rate.* We might say that the bandwidth of an Ethernet link is 10 Mbps. A useful distinction can also be made, however, between the maximum data rate that is available on the link and the number of bits per second that we can actually transmit over the link in practice. We tend to use the word *throughput* to refer to the *measured performance* of a system. Thus, because of various inefficiencies of implementation, a pair of nodes connected by a link with a bandwidth of 10 Mbps might achieve a throughput of only 2 Mbps. This would mean that an application on one host could send data to the other host at 2 Mbps.

[Source lines 35 to 46](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L35-L46)

## P04 Application bandwidth requirements

Finally, we often talk about the bandwidth *requirements* of an application. This is the number of bits per second that it needs to transmit over the network to perform acceptably. For some applications, this might be “whatever I can get”; for others, it might be some fixed number (preferably not more than the available link bandwidth); and for others, it might be a number that varies with time. We will provide more on this topic later in this section.

[Source lines 48 to 54](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L48-L54)

## P05 Link and channel bandwidth

While you can talk about the bandwidth of the network as a whole, sometimes you want to be more precise, focusing, for example, on the bandwidth of a single physical link or of a logical process-to-process channel. At the physical level, bandwidth is constantly improving, with no end in sight. Intuitively, if you think of a second of time as a distance you could measure with a ruler and bandwidth as how many bits fit in that distance, then you can think of each bit as a pulse of some width. For example, each bit on a 1-Mbps link is 1 μs wide, while each bit on a 2-Mbps link is 0.5 μs wide, as illustrated in [the referenced figure](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst). The more sophisticated the transmitting and receiving technology, the narrower each bit can become and, thus, the higher the bandwidth. For logical process-to-process channels, bandwidth is also influenced by other factors, including how many times the software that implements the channel has to handle, and possibly transform, each bit of data.

[Source lines 56 to 70](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L56-L70)

*Figure and caption omitted from this text view; see the fixed source version.*

## P06 One way latency and round trip time

The second performance metric, latency, corresponds to how long it takes a message to travel from one end of a network to the other. (As with bandwidth, we could be focused on the latency of a single link or an end-to-end channel.) Latency is measured strictly in terms of time. For example, a transcontinental network might have a latency of 24 milliseconds (ms); that is, it takes a message 24 ms to travel from one coast of North America to the other. There are many situations in which it is more important to know how long it takes to send a message from one end of a network to the other and back, rather than the one-way latency. We call this the *round-trip time* (RTT) of the network.

[Source lines 83 to 92](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L83-L92)

## P07 Propagation transmission and queuing

We often think of latency as having three components. First, there is the speed-of-light propagation delay. This delay occurs because nothing, including a bit on a wire, can travel faster than the speed of light. If you know the distance between two points, you can calculate the speed-of-light latency, although you have to be careful because light travels across different media at different speeds: It travels at 3.0 × 10<sup>8</sup> m/s in a vacuum, 2.3 × 10<sup>8</sup> m/s in a copper cable, and 2.0 × 10<sup>8</sup> m/s in an optical fiber. Second, there is the amount of time it takes to transmit a unit of data. This is a function of the network bandwidth and the size of the packet in which the data is carried. Third, there may be queuing delays inside the network, since packet switches generally need to store packets for some time before forwarding them on an outbound link. So, we could define the total latency as

[Source lines 94 to 107](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L94-L107)

## P08 Delay equations and definitions

```text
Latency = Propagation + Transmit + Queue
Propagation =  Distance/SpeedOfLight
Transmit = Size/Bandwidth
```

where `Distance` is the length of the wire over which the data will travel, `SpeedOfLight` is the effective speed of light over that wire, `Size` is the size of the packet, and `Bandwidth` is the bandwidth at which the packet is transmitted. Note that if the message contains only one bit and we are talking about a single link (as opposed to a whole network), then the `Transmit` and `Queue` terms are not relevant, and latency corresponds to the propagation delay only.

[Source lines 109 to 121](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L109-L121)

**Project teaching note, separate from the source:** The one-bit sentence is a simplification and is not an assessment rule for this lesson. Our questions use finite packets and the stated transmission formula. A finite link rate gives a nonzero time to transmit a bit.

## P09 Small messages and latency

Bandwidth and latency combine to define the performance characteristics of a given link or channel. Their relative importance, however, depends on the application. For some applications, latency dominates bandwidth. For example, a client that sends a 1-byte message to a server and receives a 1-byte message in return is latency bound. Assuming that no serious computation is involved in preparing the response, the application will perform much differently on a transcontinental channel with a 100-ms RTT than it will on an across-the-room channel with a 1-ms RTT. Whether the channel is 1 Mbps or 100 Mbps is relatively insignificant, however, since the former implies that the time to transmit a byte (`Transmit`) is 8 μs and the latter implies `Transmit` = 0.08 μs.

[Source lines 123 to 134](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L123-L134)

## P10 Large transfers and bandwidth

In contrast, consider a digital library program that is being asked to fetch a 25-megabyte (MB) image—the more bandwidth that is available, the faster it will be able to return the image to the user. Here, the bandwidth of the channel dominates performance. To see this, suppose that the channel has a bandwidth of 10 Mbps. It will take 20 seconds to transmit the image (25 × 10<sup>6</sup> × 8-bits / 10 × 10<sup>6</sup> Mbps = 20 seconds), making it relatively unimportant if the image is on the other side of a 1-ms channel or a 100-ms channel; the difference between a 20.001-second response time and a 20.1-second response time is negligible.

[Source lines 136 to 145](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L136-L145)

*Figure and caption omitted from this text view; see the fixed source version.*

**Project editorial note, separate from the source:** The original numerical expression has a units typo in its denominator. The intended calculation is `(25 x 10^6 bytes x 8 bits/byte) / (10 x 10^6 bits/s) = 20 seconds`. The original passage is retained above for traceability.

## P11 Interpreting the performance figure

[the referenced figure](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst) gives you a sense of how latency or bandwidth can dominate performance in different circumstances. The graph shows how long it takes to move objects of various sizes (1 byte, 2 KB, 1 MB) across networks with RTTs ranging from 1 to 100 ms and link speeds of either 1.5 or 10 Mbps. We use logarithmic scales to show relative performance. For a 1-byte object (say, a keystroke), latency remains almost exactly equal to the RTT, so that you cannot distinguish between a 1.5-Mbps network and a 10-Mbps network. For a 2-KB object (say, an email message), the link speed makes quite a difference on a 1-ms RTT network but a negligible difference on a 100-ms RTT network. And for a 1-MB object (say, a digital image), the RTT makes no difference—it is the link speed that dominates performance across the full range of RTT.

[Source lines 155 to 167](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L155-L167)

## P12 Latency terminology in context

Note that throughout this book we use the terms *latency* and *delay* in a generic way to denote how long it takes to perform a particular function, such as delivering a message or moving an object. When we are referring to the specific amount of time it takes a signal to propagate from one end of a link to another, we use the term *propagation delay*. Also, we make it clear in the context of the discussion whether we are referring to the one-way latency or the round-trip time.

[Source lines 169 to 175](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L169-L175)

## P13 An illustration of waiting for a response

As an aside, computers are becoming so fast that when we connect them to networks, it is sometimes useful to think, at least figuratively, in terms of *instructions per mile*. Consider what happens when a computer that is able to execute 100 billion instructions per second sends a message out on a channel with a 100-ms RTT. (To make the math easier, assume that the message covers a distance of 5000 miles.) If that computer sits idle the full 100 ms waiting for a reply message, then it has forfeited the ability to execute 10 billion instructions, or 2 million instructions per mile. It had better have been worth going over the network to justify this waste.

[Source lines 177 to 186](https://github.com/SystemsApproach/book/blob/5deec5e741e2b8c0bc44566108a24cb783c2c7de/foundation/performance.rst#L177-L186)
