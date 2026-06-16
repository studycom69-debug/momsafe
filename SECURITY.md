# Security Policy

This repository must not contain secrets or paid-service credentials.

## Do Not Commit

- API keys
- Secret tokens
- Firebase config secrets
- `.env` files
- Database passwords
- OpenAI keys
- AWS keys
- Twilio/Auth tokens
- Private certificates or signing keys (`*.pem`, `*.key`, `*.p12`, etc.)

## Required Practices

- Keep secrets only in local `.env` files or secure secret managers.
- Commit only template files such as `.env.example`.
- Use least-privilege keys wherever possible.
- Rotate any key immediately after suspected exposure.
- Review `git status` before every commit.

## If a Secret Is Accidentally Committed

1. Revoke/rotate the exposed credential immediately.
2. Remove the secret from code and commit the fix.
3. If already pushed, rewrite git history to purge the secret.
4. Notify collaborators to re-clone or resync safely after cleanup.

## Reporting

If you discover a security issue, do not post the secret in issues or PR comments. Share only sanitized details.
