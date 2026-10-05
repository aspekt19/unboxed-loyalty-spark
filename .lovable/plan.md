# Correct Concierge sign-in guidance

## Changes
- Replace every active shopper sign-in instruction that mentions SMS, phone, or passkeys with the current options: Google, email code, or external wallet.
- Update the guide, onboarding FAQ, and related active documentation that feeds the generated Concierge knowledge.
- Add a Concierge regression case that rejects obsolete sign-in methods, plus a source-content check in CI so stale wording cannot silently return.
- Regenerate the committed Concierge knowledge file from its sources.

## Verification
- Confirm generated knowledge contains the current sign-in choices and no obsolete shopper sign-in wording.
- Run the local Concierge knowledge checks, relevant tests, and type checks.
- Run the live OpenServ Concierge evaluation before deploying the updated chat function.

## Technical details
- Keep `SERV_API_KEY` and other secrets unchanged.
- Deploy only the assistant function(s) required to serve the corrected knowledge after all checks pass.
