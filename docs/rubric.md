# Scoring rubric

This is how the app turns evidence into a **pressure score** from 0 to 10 for each *job* and *driver* pair.
The language model only **extracts and classifies** evidence. All arithmetic is plain code in `src/agent/pressure-scorer.ts`.

## 1. What the model does (and nothing more)

For each piece of evidence (a *signal*) the model records: the job it affects, which of the six drivers it belongs to, a one-sentence description, the source URL if the text gives one, the date if the text states one, and a **strength** from 1 to 5.

| Strength | Meaning |
|---|---|
| 1 | A hint or passing mention |
| 2 | A minor report |
| 3 | A clear reported problem |
| 4 | A serious or widespread problem |
| 5 | Severe and well documented |

A signal with **no source URL** is marked `unsourced`. A URL that a web search did not actually return is discarded, which also makes the signal `unsourced`.

## 2. The six drivers: what counts as evidence

| Driver | Counts as evidence | Examples |
|---|---|---|
| Economic growth | Demand versus capacity | Wait times, backlogs, queue lengths |
| Security | Fraud and loss incidents | Fraud losses, thefts, breaches with losses |
| Government need | New budgets, mandates, deadlines | A funding law, a compliance deadline |
| Stability | Outages, near-failures, bailouts | System-wide outages, emergency rescue funds |
| Technology | Cost or speed gap between the old and new method | A new method that is many times cheaper or faster |
| Trust | Surveys, switching to alternatives, complaint volume | Satisfaction surveys, customers leaving, complaint counts |

## 3. The arithmetic

For each signal *i*:

```
weight_i = strength_i x source_factor_i x recency_i
source_factor = 1.0 if it has a source URL, 0.5 if unsourced
recency       = 0.5 ^ (age_in_years / 2)     (half-life of 2 years)
```

For each job and driver pair:

```
points = sum of weight_i for signals on that pair
score  = 10 x (1 - exp(-points / 8))           rounded to 2 decimals
```

So the score rises quickly at first and then flattens toward 10. Eight points (for example two sourced strength-4 signals from today) gives about 6.3. Signals dated in the future are ignored. Constants live in `SCORING` in the source and are covered by tests.

## 4. Deciding the stage of a live industry

The usual pattern is: expansion, then an incident, then a protective layer, then a rule. For a live industry the stage is a rough rule, and the person running the forecast can override it:

* Stability or security score of 6 or more, and government score below 6: **Incident**
* Stability or security of 6 or more, and government of 6 or more: **Protective layer**
* Government of 6 or more, and stability or security of 3 or more: **Rule**
* Otherwise: **Expansion**

## 5. Turning pressure into odds (the forecaster)

Also plain code, in `src/agent/forecaster.ts`:

1. Keep only cases dated **before the cutoff year** (for a live forecast, up to this year).
2. Find past steps that started from the same stage. Each is weighted by how similar its drivers are to today's pressure, a 1.5x boost for the same industry, and a recency fade (half-life 100 years).
3. Odds for each possible next stage = weighted share of past steps that went there, blended with the built-in pattern (60% on the usual next stage). When fewer than 5 comparable cases exist, the blend leans twice as hard on the pattern, the result is labelled **low evidence**, and the time window is widened.
4. The time window comes from the weighted 25th, 50th and 75th percentile of past gaps. Older gaps count less (half-life 40 years) because gaps have been shrinking: crisis to rule took 6 years (1907 to 1913), 4 years (1929 to 1933) and 2 years (2008 to 2010).

The language model then rewrites the facts as plain-English reasons. If its rewrite changes any number, the plain facts are shown instead.

## 6. Honesty rules

* Never invent a source, date or statistic. Missing evidence is stated.
* Rare shocks (pandemics, wars) cannot be predicted from this pattern. The challenger always says so, and that sentence is written by code, not by the model.
* Probabilities are odds with reasons, not predictions of certainty.
