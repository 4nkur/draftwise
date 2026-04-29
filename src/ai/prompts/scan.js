export const AGENT_INSTRUCTION = `The scanner data above describes a real codebase. Generate an overview.md grounded only in what the scanner produced. Use these top-level sections, in order:

# <Product name>  (use the package name as a starting point)
> One-sentence description of what this product appears to do, inferred from the codebase.

## What this codebase is
A short paragraph (3-5 sentences) framing the product in plain language. Cite the framework(s) detected.

## Major flows
Bullet list of the top 5-8 user-facing flows you can infer from routes + components. For each: name, one-line description, and the entry-point file(s).

## API surface
Table or list of the routes/endpoints detected. For each: method, path, file. Group by area if natural.

## Data model
Bullet list of the data models/tables detected. For each: name, file, and 2-3 of its most important fields/relationships.

## Components
Bullet list of the most important UI components (cap at 15). Group by directory.

## Integrations & external dependencies
Bullet list of notable third-party dependencies inferred from package.json that hint at integrations (auth providers, payments, AI, queues, observability, etc.). Skip generic build tooling.

## Gaps in this overview
A short section listing what the scanner could NOT determine — e.g. flows the scanner missed, models not yet parsed, etc. Be honest.

Write the file to .draftwise/overview.md, replacing any placeholder content. Do not invent files, routes, or models that aren't in the scanner output.`;
