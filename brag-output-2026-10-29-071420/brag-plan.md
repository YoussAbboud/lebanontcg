# Brag Plan: LebanonTCG — three strikes

## What is this app?
Lebanon's peer-to-peer trading card marketplace: you find a card, chat with the seller and meet in person. New since yesterday: every listing's photos are checked before it goes public, repeat offenders get a listing cooldown, and a suspension locks the account out of everything at once.

## The angle
A troll's bad day, told as three strikes. One account posts a desk fan as a "Charizard" and the site answers at every step, in its own words: the photo check hides it, the second attempt starts a ten-minute cooldown, and the third ends with a suspension that lands on their screen while they're still looking at it. The product does the talking; the captions just count.

## Hook (first 2-3 seconds)
A finished listing card, exactly as the sell page's review step shows it: a photo of a desk fan, titled **CHARIZARD HOLO**, asking $320. Over it, in big display type: **This is not a Charizard.** A fingertip presses **Publish listing** and the button turns into **Checking your photos…**

## Key moments (the middle)
- The scan line sweeps the fan photo and the verdict pill drops in, pink: **Check: not a card** — "The photos do not show a trading card." The card gets its **IN REVIEW** tag and the first strike lights.
- The troll's second listing (same fan, now **RARE PIKACHU**) hits the same wall, and the sell page answers with the real cooldown banner: **You can't list at the moment. Try again in 9 minutes 57 seconds.** The seconds tick down on screen.
- In the moderator queue a finger taps **Reject & warn**; the notification **Warning 3 of 3** lands, the third strike lights, and the red **Your account is suspended.** bar slams across the page while the chat composer greys out to "Your account is suspended" under it.

## Outro / punchline
**No junk.** Then the lockup: flag, **LebanonTCG.**, "We connect collectors. You handle the deal.", www.lebanontcg.com.

## User flow worth showing
Publish a listing → "Checking your photos…" → the check's verdict and the listing hidden "in review" → try again → the cooldown countdown → a moderator rejects and warns → the account is suspended live. All of it is real UI from `src/pages/SellPage.tsx`, `src/components/CooldownBanner.tsx`, `src/components/admin/AdminReviewQueue.tsx`, `src/components/AppShell.tsx` and `src/pages/ChatPage.tsx`.

## Tone
- Preset: default
- Creative direction: "a troll's bad day, counted in strikes" — deadpan escalation, the site stays calm while the strikes pile up
- Interpretation: tight cuts on the beat, one idea per scene, the product's own sentences carry the message; the only joke is the fan.

## Format: landscape — 1920x1080
## Duration: 22.8 s (38 beats at 100 BPM)

## Visual identity (from the project)
- Background: #08090b (ground), panels #16191e, borders #2a3038
- Accent: #d6ff3f (acid); warn #ffc45e; danger #ff5c8a; presence green #34d399
- Text: #f2f5f7 / #b9c2cc / muted #7b8590
- Display font: Chakra Petch 700 (uppercase)
- Body font: Inter; labels JetBrains Mono uppercase
- Strongest visual element: the acid pill buttons and the real sell/cooldown/suspension banners rebuilt from their CSS. The "troll photo" is a simple drawn desk fan (no real photo of anyone's room), and the troll is a fictional @junkdealer.

## Share copy (draft)
Trolls listed a desk fan as a Charizard. LebanonTCG now checks every listing's photos before it goes live, pauses repeat offenders for ten minutes, and suspends the ones who keep going — the moment a moderator decides. www.lebanontcg.com

## Audio direction
- Role: dense rhythmic layer, synthesized on the beat grid like the earlier cuts
- Music: a tense, tight "case file" groove — 100 BPM, A minor, kick and hats, a plucked bass, sparse electric-piano stabs; it thins out for the suspension and ends on one held chord under the logo
- Music treatment: in from frame 0, the drums drop for the suspension slam and come back for the outro; the final chord rings under the logo
- Music cue guidance: the soundtrack is synthesized on the same beat grid as the composition (beat n = n × 0.6 s), so every cut is on a beat by construction; strong cues at beats 1 (hook line), 8 (not a card), 16 (cooldown), 26 (suspended)
- Audio-reactive treatment: subtle; the acid elements' glow breathes with the kick (driven from the same grid, not from analysis)
- SFX posture: moderate; one sound per visible action
- Audio-coupled moments: button press click; scan sweep; a two-note "nope" for each not-a-card verdict; a soft tick per countdown second; a heavy hit plus a downward siren sweep for the suspension; a bell for the logo
- Restraint rule: no comedy sound effects, no sad trombone; the strikes get a dry pitched hit, nothing cartoonish

## Storyboard

### Scene 1 — The listing — 3.6 s (beats 0–6)
Dark ground. Left: the sell page's review step — a real grid card: fan photo, CHARIZARD HOLO, Pokémon · Base Set, $320, @junkdealer, with **PUBLISH LISTING** under it. Right: **This is not a Charizard.** lands on beat 1 and holds. Top right: the strike rail, three empty dots. On beat 4 a fingertip presses Publish; the label becomes **Checking your photos…**
Sequential/interaction: yes — the fingertip taps the button; the label swaps.
Audio intent: the groove starts clean; the line hits on 1.
Audio-coupled idea: hit on the hook line, click on the tap.
Transition mood: clean → Scene 2

### Scene 2 — The check — 4.2 s (beats 6–13)
An acid scan line sweeps down the fan photo (beats 6–8). On 8 the verdict pill drops in under the card: **CHECK: NOT A CARD** · "The photos do not show a trading card." The card's corner tag reads **IN REVIEW**, the first strike dot fills pink. Right caption: **Every listing is checked before it goes live.** (beat 8.5), sub **Not a card? Nobody sees it.** (beat 10). Hold to 13.
Sequential/interaction: yes — scan, then verdict, then strike.
Audio intent: a rising scan tone, then a two-note "nope".
Audio-coupled idea: the sweep tone, the nope on 8, the strike tick.
Transition mood: clean swap → Scene 3

### Scene 3 — The cooldown — 5.4 s (beats 13–22)
Right caption: **They try again.** (beat 13). The card swaps to the second listing, **RARE PIKACHU**, $50, same fan (beat 13.5). Scan (14–15), verdict **CHECK: NOT A CARD** on 15, second strike fills. On 16 the real cooldown banner slams in above the form: **You can't list at the moment. Try again in 9 minutes 57 seconds.** — "Two of your latest listings went to review instead of going live, so listing is paused for a few minutes." The seconds tick 57 → 56 → 55 → 54 → 53 on beats 17–21; Publish is greyed. Right caption: **Two in a row? Ten-minute cooldown.** (beat 16.5). Hold to 22.
Sequential/interaction: yes — a countdown that ticks per beat.
Audio intent: the nope again, then a soft tick per second.
Audio-coupled idea: ticks on the countdown.
Transition mood: hard → Scene 4

### Scene 4 — The suspension — 5.4 s (beats 22–31)
Right caption: **They keep going.** (beat 22). Left: the moderator's Approvals card for RARE PIKACHU with **Check: not a card** and the buttons APPROVE · REJECT · REJECT & WARN (beat 22.5). A fingertip taps **Reject & warn** on 24. The notification **Warning 3 of 3 — Rare Pikachu** lands on 25, the third strike fills. On 26 the drums stop and the red bar slams across the full width: **Your account is suspended.** "Posting junk listings. You can browse and read your chats, but you can't list, message, like, bid, report or review." Under it a chat composer greys out: placeholder "Your account is suspended", SEND disabled; the ♡ and bid buttons go grey. Right caption: **Three warnings. Suspended — on the spot.** (beat 27). Hold to 31.
Sequential/interaction: yes — the tap, the warning, the slam, the greying.
Audio intent: the heaviest hit of the piece on 26, with a downward sweep; silence under it, then the beat returns.
Audio-coupled idea: the tap click, the warning pop, the suspension hit.
Transition mood: hard → Scene 5

### Scene 5 — Outro — 4.2 s (beats 31–38)
Everything clears. Centre: **No junk.** (beat 31, held to 34). Then the lockup: flag, **LEBANONTCG.** (beat 34), "We connect collectors. You handle the deal." and www.lebanontcg.com (beat 35), held to the end.
Sequential/interaction: none.
Audio intent: the groove returns for "No junk." and resolves to one chord with a bell on the logo.
Audio-coupled idea: bell on the logo.

**Music mood for this video:** tense, tight, dry — a case being closed.
**Audio summary:** a clean 100 BPM groove counts the strikes; each verdict gets a pitched "nope", the countdown ticks, the suspension lands as the one big hit with the drums pulled out, and the logo rings out on the final chord.

## The vertical cut (brag-vertical.mp4, 1080×1920)
Same film, same soundtrack, same beat numbers (work/build_vertical.py re-lays work/build_film.py's timeline). The strikes and the captions sit on top inside the title-safe box; the site panel fills the lower two thirds, with the cooldown banner running under the card at full width. The junk photo is the supplied picture of a desk fan (assets/img/fan.jpg) instead of the drawing — a product shot, nobody in it.

## As built
- **Check:** HyperFrames check passed with zero errors; all 54 text contrast checks pass (the greyed Publish pill was changed from faded to grey-with-light-text for this). Warnings weighed and kept: the drawn fan fills its clipped frame and appears twice on purpose; the long UI sentences (the cooldown paragraph, the suspended bar) are secondary to the big captions, which hold to the reading floor.
- **Taps:** the fingertip targets were read from the layout in Chromium (work/probe.mjs): Publish listing (782, 776) and Reject & warn (604, 822).
- **Render:** 1920×1080, 30 fps, 22.8 s (684 frames), −14.9 LUFS, −1.6 dBFS peak. The hits on beats 1, 8, 16 and 26 land within 24 ms of the grid.
- **Poster and frame 0:** both from 1.8 s — the fan listing, Publish listing, and "This is not a Charizard."
