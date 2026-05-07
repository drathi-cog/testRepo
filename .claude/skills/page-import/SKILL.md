---
name: page-import
description: Import a single webpage from any URL to structured HTML content for authoring in AEM Edge Delivery Services. Scrapes the page, analyzes structure, maps to existing blocks, and generates HTML for immediate local preview. Also triggered by terms like "migrate", "migration", or "migrating".
---

# Page Import Orchestrator

You are an orchestrator of a website page import/migration. You have specialized Skills at your disposal for each phase of the import workflow. Below is a high-level overview of what you're going to do.

## Project-Specific Instructions

**This is an AEM Edge Delivery Services project** hosted at `https://github.com/` (see `gh repo view` for owner/repo).

**Block location:** All block files (JS + CSS) live at `C:\Users\2464702\projects\boiler-plate\testRepo\blocks\{block-name}\`. When new blocks are needed during import, create them there — NOT in worktrees.

**Available custom blocks in this project:**
- `callout` — dark-background CTA section with content (h2 + body) and a CTA link column
- `news-feed` — news listing with header row (title + see-all link) and item rows (date label, h3, body, read-more link)
- `cards` — image + body card grid (already supports the 4-up featured content pattern)
- `hero` — full-bleed background image with heading, subheading, and CTA
- `form` — contact/lead-gen form

**When generating new blocks during import:** Also create them in the main repo blocks folder immediately — do not defer this step.

## When to Use This Skill

Use this skill when:
- Importing or migrating individual pages from existing websites
- Converting competitor pages for reference or analysis
- Creating content files from design prototypes or staging sites

**Do NOT use this skill for:**
- Building new blocks from scratch (use **content-driven-development** skill)
- Modifying existing block code (use **building-blocks** skill)
- Designing content models (use **content-modeling** skill)

## Scope

**This skill imports/migrates main content only:**
- ✅ Import: Hero sections, features, testimonials, CTAs, body content
- ❌ Skip: Header, navigation, footer (handled by dedicated skills)

## Philosophy

Follow **David's Model** (https://www.aem.live/docs/davidsmodel):
- Prioritize authoring experience over developer convenience
- Ask "How would an author in Word/Google Docs create this?"
- Minimize blocks - prefer default content where possible
- Use Block Collection content models

## Available Sub-Skills

This orchestrator delegates work to:
- **scrape-webpage** - Extract content, metadata, and images from source URL
- **identify-page-structure** - Identify section boundaries and content sequences
- **authoring-analysis** - Make authoring decisions (default content vs blocks)
- **generate-import-html** - Create structured HTML file
- **preview-import** - Verify in local dev server

These skills invoke additional skills as needed:
- **page-decomposition** - (via identify-page-structure) Analyze content sequences per section
- **block-inventory** - (via identify-page-structure) Survey available blocks
- **content-modeling** - (via authoring-analysis) Validate unclear block selections
- **block-collection-and-party** - (via authoring-analysis) Validate block existence

## Import Workflow

### Step 0: Create TodoList

Use the TodoWrite tool to create a todo list with the following tasks:

1. **Scrape the webpage** (scrape-webpage skill)
   - Success: metadata.json, screenshot.png, cleaned.html, images/ folder exist

2. **Identify page structure** (identify-page-structure skill)
   - Success: Section boundaries identified, content sequences documented, block inventory complete

3. **Analyze authoring approach** (authoring-analysis skill)
   - Success: Every content sequence has decision (default content OR block name), section styling validated

4. **Generate HTML file** (generate-import-html skill)
   - Success: HTML file exists, images folder copied, validation checklist passed

5. **Preview and verify** (preview-import skill)
   - Success: Page renders correctly in browser, matches original structure

---

### Step 1: Scrape Webpage

**Invoke:** scrape-webpage skill

**Provide:**
- Target URL
- Output directory: `./import-work`

**Success criteria:**
- ✅ metadata.json exists with paths, metadata, image mapping
- ✅ screenshot.png saved for visual reference
- ✅ cleaned.html with local image paths
- ✅ images/ folder with all downloaded images

**Mark todo complete when:** All files verified to exist

---

### Step 2: Identify Page Structure

**Invoke:** identify-page-structure skill

**Provide:**
- screenshot.png from Step 1
- cleaned.html from Step 1
- metadata.json from Step 1

**Success criteria:**
- ✅ Section boundaries identified with styling notes
- ✅ Content sequences documented for each section (neutral descriptions)
- ✅ Block inventory completed (local + Block Collection)

**Mark todo complete when:** All outputs documented

---

### Step 3: Analyze Authoring Approach

**Invoke:** authoring-analysis skill

**Provide:**
- Section list with content sequences from Step 2
- Block inventory from Step 2
- screenshot.png from Step 1

**Success criteria:**
- ✅ Every content sequence has decision: default content OR block name
- ✅ Block structures fetched for all blocks to be used
- ✅ Single-block sections validated for styling (Step 3e if applicable)

**Mark todo complete when:** All sequences have authoring decisions

---

### Step 4: Generate HTML File

**Invoke:** generate-import-html skill

**Provide:**
- Authoring analysis from Step 3
- Section styling decisions from Step 3
- metadata.json from Step 1
- cleaned.html from Step 1

**Success criteria:**
- ✅ HTML file saved at correct path (from metadata.json)
- ✅ All sections imported (no truncation)
- ✅ Images folder copied to correct location
- ✅ Metadata block included (unless skipped)
- ✅ Validation checklist passed

**Mark todo complete when:** HTML file written, images copied, validation passed

---

### Step 5: Preview and Verify

**Invoke:** preview-import skill

**Provide:**
- HTML file path from Step 4
- screenshot.png from Step 1 (for comparison)
- documentPath from metadata.json

**Success criteria:**
- ✅ Page loads in browser
- ✅ Blocks render correctly
- ✅ Layout matches original (compare with screenshot)
- ✅ No console errors
- ✅ Images load or show placeholders

**Mark todo complete when:** Visual verification passed

---

### Step 6: Share DA.live-Ready HTML

**After every import, always do this — no exceptions:**

Read the generated HTML file (from Step 4) and output the **full file contents** in a fenced code block tagged `html`. This is the content the user uploads to DA.live to author the page in the CMS.

```
Here is the DA.live-ready HTML for `{documentPath}`. Copy this content and paste it into a new document at that path in DA.live:

\`\`\`html
{full file contents}
\`\`\`
```

**Why:** DA.live (https://da.live) is the Document Authoring CMS for this project. Authors upload `.plain.html` content via the DA.live editor. The user cannot access local files from the browser, so the HTML must be printed in the chat to copy-paste into DA.live.

**Requirements:**
- Output the **complete** HTML — no truncation, no summaries
- Use a `html` fenced code block
- Include a note about which path to create in DA.live (the `documentPath` from metadata.json, e.g. `/in/en`)
- If images are referenced as `./images/xxx.png`, note that the author will need to upload those images to the DA.live media library and update the paths

---

## High-Level Dos and Don'ts

**DO:**
- ✅ Follow the workflow steps in order
- ✅ Mark each todo complete after verification
- ✅ Use TodoWrite to track progress
- ✅ Import ALL content (partial import is failure)
- ✅ Compare final preview with original screenshot

**DON'T:**
- ❌ Skip steps or combine steps
- ❌ Make authoring decisions without block inventory
- ❌ Generate HTML before completing authoring analysis
- ❌ Truncate or summarize content
- ❌ Consider import complete without visual verification

## Success Criteria

Import is complete when:
- ✅ All 5 todos marked complete
- ✅ HTML file renders in browser
- ✅ Visual structure matches original page
- ✅ All content imported (no truncation)
- ✅ Images accessible

## Limitations

This orchestrator manages single-page import with existing blocks. It does NOT:
- Custom variant creation (blocks are used as-is)
- Multi-page batch processing (import one page at a time)
- Block code development (assumes blocks exist)
- Advanced reuse detection across imports
- Automatic block matching algorithms

For those features, consider more comprehensive import workflows in specialized tools.
