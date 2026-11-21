-- =============================================================================
-- SWIMTRACK V3 — TIER 1: PERSISTENT CHALKBOARD, REACTIONS & SQUAD BILL SPLITS
-- Postgres 15+ / Supabase compatible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PERSISTENT SQUAD CHALKBOARD MESSAGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name TEXT NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 1 AND 100),
    author_swimmer_id UUID REFERENCES public.swimmers(id) ON DELETE SET NULL,
    content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 280),
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_squad_messages_created_desc
    ON public.squad_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_squad_messages_author_swimmer
    ON public.squad_messages (author_swimmer_id)
    WHERE author_swimmer_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. EMOJI REACTIONS (FOR BOTH SQUAD MEMORIES & CHALKBOARD MESSAGES)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL CHECK (target_type IN ('memory', 'message')),
    target_id UUID NOT NULL,
    emoji TEXT NOT NULL CHECK (emoji IN ('🔥', '😂', '❤️', '🏊', '☕')),
    reactor_key TEXT NOT NULL CHECK (char_length(btrim(reactor_key)) BETWEEN 1 AND 80),
    reactor_name TEXT NOT NULL CHECK (char_length(btrim(reactor_name)) BETWEEN 1 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_squad_reaction_unique UNIQUE (target_type, target_id, emoji, reactor_key)
);

CREATE INDEX IF NOT EXISTS idx_squad_reactions_target
    ON public.squad_reactions (target_type, target_id);

-- -----------------------------------------------------------------------------
-- 3. AFTER-SWIM BILL & POOL TICKET SPLITS (SQUAD KITTY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL,
    session_id UUID REFERENCES public.swim_sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
    category TEXT NOT NULL DEFAULT 'pool_tickets' CHECK (category IN ('pool_tickets', 'cafe_food', 'transport', 'gear', 'other')),
    currency TEXT NOT NULL DEFAULT 'LKR' CHECK (char_length(btrim(currency)) BETWEEN 1 AND 8),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    paid_by_name TEXT NOT NULL CHECK (char_length(btrim(paid_by_name)) BETWEEN 1 AND 100),
    paid_by_swimmer_id UUID REFERENCES public.swimmers(id) ON DELETE SET NULL,
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_squad_expenses_date_desc
    ON public.squad_expenses (expense_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_squad_expenses_session_id
    ON public.squad_expenses (session_id)
    WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.squad_expense_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.squad_expenses(id) ON DELETE CASCADE,
    swimmer_id UUID NOT NULL REFERENCES public.swimmers(id) ON DELETE CASCADE,
    swimmer_name TEXT NOT NULL CHECK (char_length(btrim(swimmer_name)) BETWEEN 1 AND 100),
    share_amount NUMERIC(12, 2) NOT NULL CHECK (share_amount >= 0),
    is_paid BOOLEAN NOT NULL DEFAULT false,
    paid_at TIMESTAMPTZ,
    marked_by TEXT,
    CONSTRAINT uq_squad_expense_share UNIQUE (expense_id, swimmer_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_expense_shares_expense
    ON public.squad_expense_shares (expense_id);

CREATE INDEX IF NOT EXISTS idx_squad_expense_shares_swimmer_unpaid
    ON public.squad_expense_shares (swimmer_id, is_paid);

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (ADMIN CRUD; SERVICE-ROLE ROUTES HANDLE SWIMMER AUTH)
-- -----------------------------------------------------------------------------
ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_expense_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin access for squad_messages" ON public.squad_messages;
CREATE POLICY "Admin access for squad_messages" ON public.squad_messages
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin access for squad_reactions" ON public.squad_reactions;
CREATE POLICY "Admin access for squad_reactions" ON public.squad_reactions
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin access for squad_expenses" ON public.squad_expenses;
CREATE POLICY "Admin access for squad_expenses" ON public.squad_expenses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admin access for squad_expense_shares" ON public.squad_expense_shares;
CREATE POLICY "Admin access for squad_expense_shares" ON public.squad_expense_shares
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 5. AUTOMATIC UPDATED_AT TRIGGER FOR SQUAD EXPENSES
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_squad_expenses_updated_at ON public.squad_expenses;
CREATE TRIGGER trg_squad_expenses_updated_at
    BEFORE UPDATE ON public.squad_expenses
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
