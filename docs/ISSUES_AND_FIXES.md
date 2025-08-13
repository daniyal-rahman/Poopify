# Issues Identified and Fixes

- Missing `logging` import in `backend/parsers/layout_heuristics.py` caused a `NameError` during parsing. Added the import and removed an unused dependency.
- `backend/api/routes_stream.py` duplicated streaming logic and pulled in unused `asyncio`. It now reuses `tts.stream.stream_sentences` to avoid divergence and simplify the route.
- `backend/app.py` had an unused `Path` import and lacked a newline at EOF. Removed the import and tidied the file ending.
- `backend/requirements.txt` lacked a trailing newline which could confuse tooling. Added the newline.

These fixes improve runtime reliability and code cleanliness.
