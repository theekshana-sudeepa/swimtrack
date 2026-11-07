# Database Architecture & Schema

SwimTrack uses a normalized PostgreSQL schema optimized for Supabase with Row Level Security (RLS) enabled on all tables.

## Entity Relationship (ER) Diagram

```mermaid
erDiagram
    SWIMMERS ||--o{ REMINDER_PREFERENCES : has
    SWIMMERS ||--o{ SESSION_PARTICIPANTS : participates
    SWIMMERS ||--o{ ATTENDANCE : marked
    SWIMMERS ||--o{ ATTENDANCE_AUDIT_LOG : tracks
    SWIMMERS ||--o{ REMINDER_DELIVERIES : receives

    SESSION_SERIES ||--o{ SWIM_SESSIONS : generates
    
    SWIM_SESSIONS ||--o{ SESSION_PARTICIPANTS : enrolls
    SWIM_SESSIONS ||--o{ ATTENDANCE : records
    SWIM_SESSIONS ||--o{ ATTENDANCE_AUDIT_LOG : audits
    SWIM_SESSIONS ||--o{ REMINDER_DELIVERIES : logs

    SWIMMERS {
        uuid id PK
        text full_name
        text nickname
        text email
        text phone
        date join_date
        text status
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    SWIM_SESSIONS {
        uuid id PK
        uuid series_id FK
        text title
        date date
        time start_time
        time end_time
        text location
        text notes
        text status
        boolean is_finalized
        timestamptz finalized_at
    }

    ATTENDANCE {
        uuid id PK
        uuid session_id FK
        uuid swimmer_id FK
        text status
        text notes
        timestamptz marked_at
        uuid marked_by
    }

    REMINDER_DELIVERIES {
        uuid id PK
        text claim_key UK
        uuid session_id FK
        uuid swimmer_id FK
        text reminder_type
        text recipient_email
        text status
        text provider_message_id
        timestamptz sent_at
    }
```

## Migration Files

Schema migrations are located in `supabase/migrations/`:
- `20260101000000_swimtrack_schema.sql`: Complete DDL definitions, indexes, check constraints, foreign keys, and RLS policies.
- `supabase/seed.sql`: Demonstration seed data using fictional records.

## Applying Migrations

With the Supabase CLI installed:
```bash
# Reset local or remote database
supabase db reset
```

Or copy the SQL statements from `supabase/migrations/20260101000000_swimtrack_schema.sql` into the Supabase Dashboard SQL Editor.
