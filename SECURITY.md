# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| < 2.0   | :x:                |

## Security Architecture

SwimTrack employs a strict **Single-Administrator Architecture**:
1. **No Public Registration**: Self-service registration routes do not exist.
2. **Strict Identity Allowlist**: The administrator is verified against configured environment variables (`ADMIN_USER_ID` and `ADMIN_EMAIL`) on every server action and private route handler.
3. **Database Row Level Security (RLS)**: PostgreSQL tables are locked down with RLS policies in Supabase.
4. **Endpoint Protection**: Automated cron endpoints (`/api/cron/send-reminders`) require high-entropy bearer token authentication (`CRON_SECRET`).
5. **No Exposure of Service Keys**: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side code and never exposed to the client bundle.
6. **Recipient Consent**: Email reminders are only sent to swimmers who have explicitly consented (`email_reminders_enabled: true`), with persistent one-click opt-out capabilities.

## Reporting a Vulnerability

If you discover a security vulnerability within SwimTrack, please report it privately by opening a confidential security advisory on GitHub or emailing the repository maintainer directly.
