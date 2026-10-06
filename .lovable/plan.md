# Discover visibility indicator

## What will change
- Add a clear status panel to the merchant Business Profile section.
- Show **Visible in Discover** when business name, description, logo, and location are filled in.
- Otherwise show **Not visible in Discover** with a checklist of exactly which required profile fields are missing.
- Keep the status live while editing and update it immediately after saving.

## Technical details
- Reuse the existing Discover completeness rule so the owner indicator cannot drift from the customer-facing filter.
- Extend the shared visibility helper with missing-field labels and add focused tests for all four required fields.
- Use existing semantic colors and interface components; no backend or agent/API behavior changes.
