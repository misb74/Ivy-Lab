---
name: nano-pdf
description: "Edit PDF text/typos/titles via nano-pdf CLI (NL prompts)."
version: 1.0.0
author: community
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [PDF, Documents, Editing, NLP, Productivity]
    homepage: https://pypi.org/project/nano-pdf/
---

# nano-pdf

Edit PDFs using natural-language instructions. Point it at a page and describe what to change.

## Prerequisites

Already installed in the Lab in a dedicated uv-managed venv at `~/.ivy-lab/venv-nano-pdf` (Python 3.12). Activate before use:

```bash
source ~/.ivy-lab/venv-nano-pdf/bin/activate
nano-pdf --help
```

If not yet installed:

```bash
uv venv ~/.ivy-lab/venv-nano-pdf --python 3.12
source ~/.ivy-lab/venv-nano-pdf/bin/activate
uv pip install nano-pdf
```

**API key**: nano-pdf uses Gemini 3 Pro Image ("Nano Banana") under the hood. Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` before running `edit`. The skill works without a key for `--help`/`version`, but `edit`/`add` will fail without one.

## Usage

Note: the installed CLI takes pairs of `PageNumber Prompt` rather than a single page+instruction:

```bash
nano-pdf edit <file.pdf> <page_number> "<instruction>" [<page_number> "<instruction>"...]
```

## Examples

```bash
# Change a title on page 1
nano-pdf edit deck.pdf 1 "Change the title to 'Q3 Results' and fix the typo in the subtitle"

# Edit two pages in one call
nano-pdf edit report.pdf 3 "Update the date from January to February 2026" 4 "Fix typo in heading"

# Optional: pass extra reference pages to keep style consistent
nano-pdf edit deck.pdf 1 "Change the title" --style-refs 5,6

# Add a new slide
nano-pdf add deck.pdf 0 "Title slide with 'Welcome to Q3 Review'"
```

## Notes

- Page numbers may be 0-based or 1-based depending on version — if the edit hits the wrong page, retry with ±1
- Always verify the output PDF after editing (use `read_file` to check file size, or open it)
- The tool uses an LLM under the hood — requires an API key (check `nano-pdf --help` for config)
- Works well for text changes; complex layout modifications may need a different approach
