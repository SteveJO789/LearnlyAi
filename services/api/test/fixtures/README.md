# Synthetic learner fixtures

These assets are test inputs authored for this project. They are not reviewed Knowledge or educational source citations.

- `own-thai-math.png`: original text `โจทย์ 2 + 3 = 5`, rendered locally at800×200 with Noto Sans Thai. SHA256 `a96ec083383c8d7feeb12dd76fc053ce506fd302da1fa91d9046e3815575ae64`. Font from official Google Fonts revision `bd8f81ddb5c74d5c8897b36ad88b440266245103`, `ofl/notosansthai/NotoSansThai[wdth,wght].ttf`, SHA256 `5a1c559bb539583c8a1fd99d1c5b9491e5e14478c9cd2bd0970d5c3096cc9ef8`. The font itself is not distributed here. Verified [OFL1.1 notice](https://github.com/google/fonts/blob/bd8f81ddb5c74d5c8897b36ad88b440266245103/ofl/notosansthai/OFL.txt), SHA256 `2e98fd23a52d253db8612cd5942c8f2ff4111b21d2367050fdca91d8ccc374a0`; font-created documents are not subject to the font-license requirement.
- `own-encrypted.pdf`: original synthetic `V = I R` PDF from `real-file-fixtures.mjs`, encrypted once using existing local pypdf6.11.0 and a synthetic test-only password. Python/pypdf is not an application/CI runtime dependency.
- Other PDFs/PNGs are generated deterministically by `real-file-fixtures.mjs`. Latin image rendering uses unmodified Liberation Sans shipped with pinned PDF.js; its `standard_fonts/LICENSE_LIBERATION` contains the font'sGPLv2 document exception. No external course/page content or reviewed status is invented.

Initial hand-drawn bitmap OCR misread `2+3=5` as `2ts=5`. Its failure is retained in the verification report; the clear standard-font fixture checks a narrow recognition regression, not general mathematical/handwriting accuracy.
