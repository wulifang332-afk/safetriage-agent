# SafeTriage

SafeTriage is a course-project prototype for CA6117, demonstrating an agentic AI workflow for patient portal message triage and clinician-supervised response drafting.

The prototype uses simulated patient data, clinic guideline snippets, safety rules, tool calls, human checkpoints, and an audit trail. It is designed for demonstration only and does not provide medical advice.

## Features

- Patient portal inbox with routine, medium-risk, and high-risk examples
- Visible Perceive -> Reason -> Act workflow
- Simulated tool calls for patient lookup, guideline retrieval, safety checks, and draft generation
- Retrieved sources and confidence score display
- Human controls to approve, edit, or escalate an agent recommendation
- Audit trail of input, actions, sources, outputs, timestamps, and human decisions
- Safety response for red-flag symptoms and prompt-injection attempts

## Run Locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Safety Scope

This is not a diagnostic or treatment system. It is a clinician-support prototype using fictional data. All patient-facing messages require human review before sending.
