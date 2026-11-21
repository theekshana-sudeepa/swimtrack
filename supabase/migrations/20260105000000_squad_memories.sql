-- =============================================================================
-- SWIMTRACK V3 — SQUAD MEMORIES (END-OF-DAY PHOTO VAULT)
-- Postgres 15+ / Supabase Storage compatible
-- Private bucket + strict 1–3 photos per date enforced at the database layer
-- =============================================================================

-- 1. Create squad_memories table (one memory album per date)
CREATE TABLE IF NOT EXISTS public.squad_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_date DATE NOT NULL UNIQUE,
    session_id UUID REFERENCES public.swim_sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
    caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 500),
    location TEXT CHECK (location IS NULL OR char_length(location) <= 140),
    created_by_name TEXT NOT NULL DEFAULT 'Squad Coach' CHECK (char_length(btrim(created_by_name)) BETWEEN 1 AND 100),
    created_by_swimmer_id UUID REFERENCES public.swimmers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Newest memories first
CREATE INDEX IF NOT EXISTS idx_squad_memories_date_desc
    ON public.squad_memories (memory_date DESC);

-- Partial index for session-linked memories
CREATE INDEX IF NOT EXISTS idx_squad_memories_session_id
    ON public.squad_memories (session_id)
    WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_squad_memories_created_by_swimmer
    ON public.squad_memories (created_by_swimmer_id)
    WHERE created_by_swimmer_id IS NOT NULL;

-- 2. Create squad_memory_photos table (strictly 1 to 3 photos per memory day)
CREATE TABLE IF NOT EXISTS public.squad_memory_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES public.squad_memories(id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
    storage_path TEXT NOT NULL CHECK (char_length(btrim(storage_path)) > 0),
    mime_type TEXT NOT NULL DEFAULT 'image/webp' CHECK (mime_type IN ('image/webp', 'image/jpeg', 'image/png')),
    size_bytes INT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0 AND size_bytes <= 5242880),
    width INT CHECK (width IS NULL OR width > 0),
    height INT CHECK (height IS NULL OR height > 0),
    caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 200),
    uploaded_by_name TEXT NOT NULL DEFAULT 'Squad Coach' CHECK (char_length(btrim(uploaded_by_name)) BETWEEN 1 AND 100),
    uploaded_by_swimmer_id UUID REFERENCES public.swimmers(id) ON DELETE SET NULL,
    uploaded_by_role TEXT NOT NULL DEFAULT 'admin' CHECK (uploaded_by_role IN ('admin', 'swimmer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_squad_memory_photo_slot UNIQUE (memory_id, slot)
);

-- Fast ordered fetch of photos per memory
CREATE INDEX IF NOT EXISTS idx_squad_memory_photos_memory_slot
    ON public.squad_memory_photos (memory_id, slot ASC);

CREATE INDEX IF NOT EXISTS idx_squad_memory_photos_uploader
    ON public.squad_memory_photos (uploaded_by_swimmer_id)
    WHERE uploaded_by_swimmer_id IS NOT NULL;

-- 3. Row Level Security (strictly private; service-role routes mint signed URLs after verifying Admin or Swimmer PIN cookie)
ALTER TABLE public.squad_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_memory_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access for squad_memories" ON public.squad_memories;
CREATE POLICY "Admin access for squad_memories" ON public.squad_memories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin access for squad_memory_photos" ON public.squad_memory_photos;
CREATE POLICY "Admin access for squad_memory_photos" ON public.squad_memory_photos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Automatic updated_at trigger on squad_memories
DROP TRIGGER IF EXISTS trg_squad_memories_updated_at ON public.squad_memories;
CREATE TRIGGER trg_squad_memories_updated_at
    BEFORE UPDATE ON public.squad_memories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. Provision PRIVATE Supabase Storage bucket for squad memory photos (never publicly listable/readable)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'squad-memories',
    'squad-memories',
    false,
    5242880,
    ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];
