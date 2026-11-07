# Email Reminder System

SwimTrack integrates with **Resend** and **React Email** to deliver beautiful, responsive HTML email notifications for squad swimming practices.

## Automatic Daily Morning Reminders

By default, SwimTrack notifies participants on the morning before their practice (~8:00 AM Asia/Colombo time).

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "30 2 * * *"
    }
  ]
}
```
*02:30 UTC corresponds to 08:00 AM Sri Lanka Standard Time (UTC+05:30).*

## Atomic Claim Keys & Duplicate Prevention

To eliminate accidental duplicate sends under cron retries:
1. Every reminder generates a deterministic claim key:
   `${sessionId}:${swimmerId}:${reminderType}:${sessionDate}`
2. Before dispatching, the database checks `reminder_deliveries` for an existing record with this unique claim key.
3. The claim key is also passed in the Resend SDK `Idempotency-Key` header.
4. If a send attempt is repeated, the handler immediately identifies the existing claim and skips transmission safely.

## Recipient Consent

Under SwimTrack's consent rules:
- An email address is strictly optional for swimmers.
- Only swimmers with `email_reminders_enabled: true` are queried.
- Every email includes a personalized unsubscribe link (`/reminders/opt-out?token=...`) enabling one-click self-service opt-out without requiring an account.
- Archived swimmers are automatically excluded.

