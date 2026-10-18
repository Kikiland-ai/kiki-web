# Preserved CAM consumer contract

Imported locally from the verified `learning-all-cam-handoff.zip` (77 manifest entries; exact membership, sizes and SHA-256 verified). Archive SHA-256: `13a58628c0bdb383642ac45d949dcf1d563cb99d7b3bb0a93e484298e5dc83a9`.

- `policies.json`: supplied model version, original `models.js` SHA and ten exact control domains.
- `conformance.json`: all 38 supplied model behavior cases.
- `scenes.json`: exact saved scene JSON, original scene-byte hashes and candidate source/model bindings. Both runtime validators pin these records rather than trusting code/formulas in API data.
- `provenance.json`: actual web/backend bases, archive hash and vendored consumer hash. The producer is a local uncommitted backend candidate, not proof of running-backend provenance.

`apps/web/src/media/cam-models.mjs` is byte-identical to the supplied `consumer/cam-models.mjs`: SHA-256 `0ce32bbbd04153a71dfb265fd1d89f63796a5588763869737db9c29a1d7b7e79`. Its wrapper/export differs from the original standalone `models.js` (SHA `41cb3e229a603040d7b1dea9e47e4f8563a347f15aaa1c731c64c02f9a3420a5`), whose hash the original candidate model bindings retain. These are separate file identities. Do not silently reformat the vendored module.

React uses its typed numerical result to create SVG elements; returned HTML/SVG strings are not injected. The native C-AM-08 package remains unchanged. Raw candidate records live only in explicit development fixtures; 26 original content-addressed WAVs live in `../all-cam/assets`. Production builds exclude those fixtures and WAVs.

No publication/head activation or content review is implied. C-AM-01 has two traces despite the three-trace brief; C-AM-04 fixes carrier at 2000 Hz despite authored adjustable fc; FM/PM are normalized teaching examples. Scientific/native-Odia/pronunciation/fidelity/audio-quality reviews remain pending. English narration exists only in C-AM-08. No sentence timing exists. [Current results](../../../docs/evidence/all-cam-coverage-2026-10-18.md).
