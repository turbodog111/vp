# Free HRTF comparison notes (Traveling Voices)

## What we have now

| Cut | HRTF | What it is |
|-----|------|------------|
| Phrase-Word Lead / Slow Glide | **MIT KEMAR** | Dummy-head lab standard. Dense, neutral, very common. |
| Slow Glide SADIE **D1** | **SADIE II D1** | High-res **dummy** set from York. |
| Slow Glide SADIE **H3** | **SADIE II H3** | One **human** subject from the same database. |
| Slow Glide **CIPIC 050** | **CIPIC subject 050** | Full-length bake of HRTF Clip Lab pick (UC Davis human). |
| Slow Glide **CIPIC 050 Quiet Inst** | **CIPIC subject 050** | Same as above; instrumental bed ×0.75 (−25%). Vocals/drums/phrase/spatial unchanged. |

### Why D1 vs H3 can feel “the same”

1. **Same compass map** — both Slow Glide cuts use identical pose motion and phrase leads. Only the ear filter changes.
2. **Same family** — SADIE II dummies and humans were measured in one pipeline; many subjects are closer than KEMAR vs a wild human set.
3. **Music masks cues** — dense stereo vocals + drums hide subtle pinna / rear differences.
4. **Headphones + fit** — without individualized HRTFs, front/back and “out of head” often collapse for everyone.

**Listening tip:** A/B on the *same* 5–8 s hop with **hard L/R → rear → front** motion (not the quiet intro). Mute one ear briefly on rear poses — if image doesn’t leave the head, the HRTF isn’t winning for your ears.

**Practical ranking so far (generic ears):**  
KEMAR Slow Glide is the baseline. SADIE D1/H3 are usually a *small* color shift, not a new architecture. If you can’t hear them, prefer **KEMAR** for simplicity and drop the SADIE pair from the A/B shortlist.

---

## Better free alternatives (more contrast)

These tend to sound *more* different from KEMAR than SADIE-H3 does:

| Dataset | License / access | Why try it |
|---------|------------------|------------|
| **IRCAM Listen** (e.g. IRC_1040) | Free research | Classic human SOFA; 1040 is a frequent “sounds different” pick in tools. |
| **CIPIC** | Free research | 45 humans + anthropometrics; pick a subject far from average pinna. |
| **SONICOM** (200 humans) | Free (MIT-ish access) | Large modern set; good for “find one that fits me.” |
| **ARI** (Vienna) | Free research SOFA | High-resolution in-the-ear human sets. |
| **SADIE II other subjects** | Free | Skip D1 dummy; try several **H\*** humans until one clicks. |

### What would make a *useful* A/B pack

Bake **same Slow Glide map + same phrase leads**, only HRTF changes:

1. **KEMAR** (current Slow Glide) — control  
2. **Listen IRC_1040** (or best-available free human) — max contrast  
3. **One CIPIC / SONICOM subject** you pick after a 30 s headphone check  

Optional: a 20 s “compass tour only” clip (no full mix) so ear filters aren’t buried under drums.

---

## Female-Dominant Rectangle (experiment)

Fixed ♀ L/R + ♂ F/B. In practice the four mono images often **sum to center** on headphones (same content, symmetric gains) → origin feels middle. Architecture idea is fine; this execution doesn’t read. Prefer Traveling Voices dual-lead motion for directional clarity.
