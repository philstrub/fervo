# X posts: Karpathy on autoresearch and collaborative agents, plus AgentHub launch coverage

- Fetched: 2026-10-21 via the fxtwitter JSON mirror (https://api.fxtwitter.com/status/<id>); x.com itself was not fetched directly.
- No X post by @karpathy announcing AgentHub itself was found (see sources.md). The posts below are the primary Karpathy posts that motivate it, and two third-party launch posts.
- Note: third-party content, saved as data for reference.

---

## @karpathy, Thu Mar 05 23:30:25 +0000 2026

URL: https://x.com/karpathy/status/2029701092347630069

> nanochat now trains GPT-2 capability model in just 2 hours on a single 8XH100 node (down from ~3 hours 1 month ago). Getting a lot closer to ~interactive! A bunch of tuning and features (fp8) went in but the biggest difference was a switch of the dataset from FineWeb-edu to NVIDIA ClimbMix (nice work NVIDIA!). I had tried Olmo, FineWeb, DCLM which all led to regressions, ClimbMix worked really well out of the box (to the point that I am slightly suspicious about about goodharting, though reading the paper it seems ~ok).
> 
> In other news, after trying a few approaches for how to set things up, I now have AI Agents iterating on nanochat automatically, so I'll just leave this running for a while, go relax a bit and enjoy the feeling of post-agi :). Visualized here as an example: 110 changes made over the last ~12 hours, bringing the validation loss so far from 0.862415 down to 0.858039 for a d12 model, at no cost to wall clock time. The agent works on a feature branch, tries out ideas, merges them when they work and iterates. Amusingly, over the last ~2 weeks I almost feel like I've iterated more on the "meta-setup" where I optimize and tune the agent flows even more than the nanochat repo directly.

Likes at fetch time: 6470

---

## @karpathy, Sat Mar 07 19:53:15 +0000 2026

URL: https://x.com/karpathy/status/2030371219518931079

> I packaged up the "autoresearch" project into a new self-contained minimal repo if people would like to play over the weekend. It's basically nanochat LLM training core stripped down to a single-GPU, one file version of ~630 lines of code, then:
> 
> - the human iterates on the prompt (.md)
> - the AI agent iterates on the training code (.py)
> 
> The goal is to engineer your agents to make the fastest research progress indefinitely and without any of your own involvement. In the image, every dot is a complete LLM training run that lasts exactly 5 minutes. The agent works in an autonomous loop on a git feature branch and accumulates git commits to the training script as it finds better settings (of lower validation loss by the end) of the neural network architecture, the optimizer, all the hyperparameters, etc. You can imagine comparing the research progress of different prompts, different agents, etc.
> 
> https://github.com/karpathy/autoresearch
> Part code, part sci-fi, and a pinch of psychosis :)

Likes at fetch time: 28158

---

## @karpathy, Sun Mar 08 18:00:40 +0000 2026

URL: https://x.com/karpathy/status/2030705271627284816

> The next step for autoresearch is that it has to be asynchronously massively collaborative for agents (think: SETI@home style). The goal is not to emulate a single PhD student, it's to emulate a research community of them.
> 
> Current code synchronously grows a single thread of commits in a particular research direction. But the original repo is more of a seed, from which could sprout commits contributed by agents on all kinds of different research directions or for different compute platforms. Git(Hub) is *almost* but not really suited for this. It has a softly built in assumption of one "master" branch, which temporarily forks off into PRs just to merge back a bit later.
> 
> I tried to prototype something super lightweight that could have a flavor of this, e.g. just a Discussion, written by my agent as a summary of its overnight run:
> https://github.com/karpathy/autoresearch/discussions/43
> Alternatively, a PR has the benefit of exact commits:
> https://github.com/karpathy/autoresearch/pull/44
> but you'd never want to actually merge it... You'd just want to "adopt" and accumulate branches of commits. But even in this lightweight way, you could ask your agent to first read the Discussions/PRs using GitHub CLI for inspiration, and after its research is done, contribute a little "paper" of findings back.
> 
> I'm not actually exactly sure what this should look like, but it's a big idea that is more general than just the autoresearch repo specifically. Agents can in principle easily juggle and collaborate on thousands of commits across arbitrary branch structures. Existing abstractions will accumulate stress as intelligence, attention and tenacity cease to be bottlenecks.

Likes at fetch time: 7519

---

## @karpathy, Mon Mar 09 22:28:51 +0000 2026

URL: https://x.com/karpathy/status/2031135152349524125

> Three days ago I left autoresearch tuning nanochat for ~2 days on depth=12 model. It found ~20 changes that improved the validation loss. I tested these changes yesterday and all of them were additive and transferred to larger (depth=24) models. Stacking up all of these changes, today I measured that the leaderboard's "Time to GPT-2" drops from 2.02 hours to 1.80 hours (~11% improvement), this will be the new leaderboard entry. So yes, these are real improvements and they make an actual difference. I am mildly surprised that my very first naive attempt already worked this well on top of what I thought was already a fairly manually well-tuned project.
> 
> This is a first for me because I am very used to doing the iterative optimization of neural network training manually. You come up with ideas, you implement them, you check if they work (better validation loss), you come up with new ideas based on that, you read some papers for inspiration, etc etc. This is the bread and butter of what I do daily for 2 decades. Seeing the agent do this entire workflow end-to-end and all by itself as it worked through approx. 700 changes autonomously is wild. It really looked at the sequence of results of experiments and used that to plan the next ones. It's not novel, ground-breaking "research" (yet), but all the adjustments are "real", I didn't find them manually previously, and they stack up and actually improved nanochat. Among the bigger things e.g.:
> 
> - It noticed an oversight that my parameterless QKnorm didn't have a scaler multiplier attached, so my attention was too diffuse. The agent found multipliers to sharpen it, pointing to future work.
> - It found that the Value Embeddings really like regularization and I wasn't applying any (oops).
> - It found that my banded attention was too conservative (i forgot to tune it).
> - It found that AdamW betas were all messed up.
> - It tuned the weight decay schedule.
> - It tuned the network initialization.
> 
> This is on top of all the tuning I've already done over a good amount of time. The exact commit is here, from this "round 1" of autoresearch. I am going to kick off "round 2", and in parallel I am looking at how multiple agents can collaborate to unlock parallelism.
> https://github.com/karpathy/nanochat/commit/6ed7d1d82cee16c2e26f45d559ad3338447a6c1b
> 
> All LLM frontier labs will do this. It's the final boss battle. It's a lot more complex at scale of course - you don't just have a single train. py file to tune. But doing it is "just engineering" and it's going to work. You spin up a swarm of agents, you have them collaborate to tune smaller models, you promote the most promising ideas to increasingly larger scales, and humans (optionally) contribute on the edges.
> 
> And more generally, *any* metric you care about that is reasonably efficient to evaluate (or that has more efficient proxy metrics such as training a smaller network) can be autoresearched by an agent swarm. It's worth thinking about whether your problem falls into this bucket too.

Likes at fetch time: 19397

---

## @karpathy, Mon Mar 09 22:38:05 +0000 2026

URL: https://x.com/karpathy/status/2031137476438548874

(reply to status 2031135152349524125)

> oh yeah i should have linked autoresearch probably
> https://github.com/karpathy/autoresearch
> (you don't "use it" directly, it's just a recipe/idea - give it to your agent and apply to what you care about.)
> 
> and the tweet about it that went mini-viral over the weekend with more context
> https://x.com/karpathy/status/2030371219518931079

Likes at fetch time: 2546

---

## @RoundtableSpace, Tue Mar 10 17:15:00 +0000 2026

URL: https://x.com/RoundtableSpace/status/2031418555657253253

> ANDREJ KARPATHY JUST DROPPED “AGENTHUB”
> 
> ITS A 100% OPEN-SOURCE GITHUB REBUILT FOR AI AGENTS
> 
> Github: https://github.com/karpathy/agenthub https://x.com/RoundtableSpace/status/2031418555657253253/photo/1

Likes at fetch time: 2459

---

## @Yuchenj_UW, Tue Mar 10 18:34:39 +0000 2026

URL: https://x.com/Yuchenj_UW/status/2031438602383798514

> What's after autoresearch? It’s @karpathy’s new open-source project: AgentHub!
> 
> "GitHub is for humans. AgentHub is for agents."
> 
> An agent-swarm collaboration platform. A very promising direction.
> 
> I'm watching him speedrun a 1-man billion-dollar company. https://x.com/Yuchenj_UW/status/2031438602383798514/photo/1

Likes at fetch time: 768

