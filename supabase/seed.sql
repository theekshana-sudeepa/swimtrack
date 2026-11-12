-- =============================================================================
-- SWIMTRACK V2 — DEMO SEED DATA (Fictional Records Only)
-- Safe for local development and demonstration environments
-- =============================================================================

-- Clear existing demo data cleanly
TRUNCATE public.attendance_audit_log, public.reminder_deliveries, public.attendance, 
         public.session_participants, public.swim_sessions, public.session_series, 
         public.reminder_preferences, public.swimmers CASCADE;

-- Insert Swimmers
INSERT INTO public.swimmers (id, full_name, nickname, email, phone, join_date, status, notes, avatar_color) VALUES
('11111111-1111-1111-1111-111111111101', 'Liam Perera', 'Liam', 'liam.perera@example.test', '+94 77 123 4567', '2025-01-10', 'active', 'Prefers freestyle and butterfly lanes.', 'ocean'),
('11111111-1111-1111-1111-111111111102', 'Kavindi Silva', 'Kavi', 'kavindi.silva@example.test', '+94 71 234 5678', '2025-01-12', 'active', 'Distance swimmer, training for 1500m open water.', 'aqua'),
('11111111-1111-1111-1111-111111111103', 'Senuka Fernando', 'Sen', 'senuka.f@example.test', '+94 76 345 6789', '2025-01-15', 'active', 'Backstroke specialist, consistent morning attendance.', 'seafoam'),
('11111111-1111-1111-1111-111111111104', 'Dilshan Mendis', 'Dilla', 'dilshan.m@example.test', '+94 70 456 7890', '2025-02-01', 'active', 'Focusing on technique improvement and breaststroke drill.', 'coral'),
('11111111-1111-1111-1111-111111111105', 'Amara Jayawardena', 'Amy', 'amara.j@example.test', '+94 75 567 8901', '2025-02-05', 'active', 'Sprint specialist, enthusiastic team motivator.', 'ocean'),
('11111111-1111-1111-1111-111111111106', 'Ryan Wickremasinghe', 'Ry', 'ryan.w@example.test', '+94 72 678 9012', '2025-02-10', 'active', 'Works shifts, sometimes arrives 10 mins late on Tuesdays.', 'aqua'),
('11111111-1111-1111-1111-111111111107', 'Ananya De Silva', 'Ana', 'ananya.ds@example.test', '+94 78 789 0123', '2025-02-15', 'active', 'High endurance, perfect attendance track record.', 'seafoam'),
('11111111-1111-1111-1111-111111111108', 'Tharindu Bandara', 'TB', 'tharindu.b@example.test', '+94 77 890 1234', '2025-02-20', 'active', 'Loves interval conditioning sets.', 'coral'),
('11111111-1111-1111-1111-111111111109', 'Maya Alwis', 'May', 'maya.alwis@example.test', '+94 74 901 2345', '2025-03-01', 'active', 'New joiner, working on flip turns and breathing pacing.', 'ocean'),
('11111111-1111-1111-1111-111111111110', 'Dinesh Ratnayake', 'Din', 'dinesh.r@example.test', '+94 70 012 3456', '2025-01-05', 'archived', 'Relocated abroad for study; archived temporarily.', 'ocean');

-- Reminder preferences
INSERT INTO public.reminder_preferences (swimmer_id, email_reminders_enabled, opt_out_token) VALUES
('11111111-1111-1111-1111-111111111101', true, 'token_liam_perera_2026'),
('11111111-1111-1111-1111-111111111102', true, 'token_kavindi_silva_2026'),
('11111111-1111-1111-1111-111111111103', true, 'token_senuka_fernando_2026'),
('11111111-1111-1111-1111-111111111104', true, 'token_dilshan_mendis_2026'),
('11111111-1111-1111-1111-111111111105', true, 'token_amara_j_2026'),
('11111111-1111-1111-1111-111111111106', true, 'token_ryan_w_2026'),
('11111111-1111-1111-1111-111111111107', true, 'token_ananya_ds_2026'),
('11111111-1111-1111-1111-111111111108', false, 'token_tharindu_b_2026'),
('11111111-1111-1111-1111-111111111109', true, 'token_maya_alwis_2026'),
('11111111-1111-1111-1111-111111111110', false, 'token_dinesh_r_2026');

-- Session Series
INSERT INTO public.session_series (id, title, location, recurrence_rule, day_of_week, start_time, end_time, start_date, active) VALUES
('22222222-2222-2222-2222-222222222201', 'Saturday Morning Endurance Squad', 'Bandaranayake College Swimming Pool Complex, Gampaha', 'weekly', 6, '06:30:00', '08:00:00', '2025-01-01', true),
('22222222-2222-2222-2222-222222222202', 'Wednesday Evening Technique Drills', 'Ranaviru Apparels Swimming Pool, Yakkala', 'weekly', 3, '18:30:00', '19:45:00', '2025-01-01', true);

-- Past Sessions and Next Upcoming Session (dates around November 2026 as per local context)
INSERT INTO public.swim_sessions (id, series_id, title, date, start_time, end_time, location, latitude, longitude, geofence_radius, notes, status, is_finalized) VALUES
('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'Saturday Morning Endurance Squad', '2026-10-24', '06:30:00', '08:00:00', 'Bandaranayake College Swimming Pool Complex, Gampaha', 7.0917, 79.9996, 30, 'Aerobic capacity set: 20x100m on 1:45.', 'completed', true),
('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', 'Wednesday Evening Technique Drills', '2026-10-28', '18:30:00', '19:45:00', 'Ranaviru Apparels Swimming Pool, Yakkala', 7.0785, 80.0360, 30, 'Breaststroke timing and high elbow recovery.', 'completed', true),
('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', 'Saturday Morning Endurance Squad', '2026-10-31', '06:30:00', '08:00:00', 'Bandaranayake College Swimming Pool Complex, Gampaha', 7.0917, 79.9996, 30, 'Halloween distance challenge: 3000m progressive ladder.', 'completed', true),
('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222202', 'Wednesday Evening Technique Drills', '2026-11-04', '18:30:00', '19:45:00', 'Ranaviru Apparels Swimming Pool, Yakkala', 7.0785, 80.0360, 30, 'Starts, relay takeoffs, and underwater streamline kicks.', 'completed', true),
('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222201', 'Saturday Morning Endurance Squad', '2026-11-07', '06:30:00', '08:00:00', 'Bandaranayake College Swimming Pool Complex, Gampaha', 7.0917, 79.9996, 30, 'Focus on 400m pacing and threshold heart rate tracking.', 'scheduled', false),
('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222202', 'Wednesday Evening Technique Drills', '2026-11-11', '18:30:00', '19:45:00', 'Ranaviru Apparels Swimming Pool, Yakkala', 7.0785, 80.0360, 30, 'Turn perfection and negative split intervals.', 'scheduled', false);

-- Enroll active swimmers in sessions
INSERT INTO public.session_participants (session_id, swimmer_id)
SELECT s.id, sw.id 
FROM public.swim_sessions s
CROSS JOIN public.swimmers sw
WHERE sw.status = 'active';

-- Attendance records for past completed sessions
-- Session 1
INSERT INTO public.attendance (session_id, swimmer_id, status, notes) VALUES
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', 'present', 'Great pace throughout the 100s'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111102', 'present', 'Completed all 20 intervals cleanly'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111103', 'present', 'Leading lane 2'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111104', 'late', 'Arrived 10m late due to traffic'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111105', 'present', 'Full session completed'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111106', 'absent', 'Did not attend'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111107', 'present', 'Strong performance'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111108', 'present', 'Joined interval 4 onwards'),
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111109', 'excused', 'Exam preparation');

-- Session 2
INSERT INTO public.attendance (session_id, swimmer_id, status, notes) VALUES
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111101', 'present', NULL),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111102', 'present', NULL),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111103', 'present', NULL),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111104', 'present', NULL),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111105', 'excused', 'Family event'),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111106', 'late', 'Worked overtime'),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111107', 'present', NULL),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111108', 'present', NULL),
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111109', 'present', 'Solid technique progress');

-- Session 3
INSERT INTO public.attendance (session_id, swimmer_id, status, notes) VALUES
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111101', 'present', 'Completed ladder'),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111102', 'present', 'Extra 500m cooldown'),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111103', 'present', NULL),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111104', 'present', NULL),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111105', 'present', NULL),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111106', 'present', NULL),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111107', 'present', NULL),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111108', 'absent', 'Unwell'),
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111109', 'late', 'Equipment delay');

-- Session 4
INSERT INTO public.attendance (session_id, swimmer_id, status, notes) VALUES
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111101', 'present', NULL),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111102', 'present', NULL),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111103', 'present', NULL),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111104', 'late', '15m late'),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111105', 'present', NULL),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111106', 'absent', NULL),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111107', 'present', NULL),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111108', 'present', NULL),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111109', 'present', NULL);

-- Session 5 (Upcoming session - attendance ready to be marked!)
INSERT INTO public.attendance (session_id, swimmer_id, status) VALUES
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111101', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111102', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111103', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111104', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111105', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111106', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111107', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111108', 'not_marked'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111109', 'not_marked');

-- Sample Audit Log Entries
INSERT INTO public.attendance_audit_log (session_id, swimmer_id, old_status, new_status, change_reason) VALUES
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111104', 'not_marked', 'late', 'Swimmer arrived during warmup set'),
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111104', 'not_marked', 'late', 'Late arrival due to highway queue');

-- Sample Reminder Deliveries
INSERT INTO public.reminder_deliveries (claim_key, session_id, swimmer_id, reminder_type, recipient_email, status, provider_message_id, sent_at) VALUES
('33333333-3333-3333-3333-333333333304:11111111-1111-1111-1111-111111111101:upcoming:2026-11-03', '33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111101', 'upcoming', 'liam.perera@example.test', 'sent', 'msg_resend_demo_01', '2026-11-03 02:30:00+00'),
('33333333-3333-3333-3333-333333333304:11111111-1111-1111-1111-111111111102:upcoming:2026-11-03', '33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111102', 'upcoming', 'kavindi.silva@example.test', 'sent', 'msg_resend_demo_02', '2026-11-03 02:30:00+00'),
('33333333-3333-3333-3333-333333333305:11111111-1111-1111-1111-111111111101:upcoming:2026-11-06', '33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111101', 'upcoming', 'liam.perera@example.test', 'sent', 'msg_resend_demo_03', '2026-11-06 02:30:00+00'),
('33333333-3333-3333-3333-333333333305:11111111-1111-1111-1111-111111111102:upcoming:2026-11-06', '33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111102', 'upcoming', 'kavindi.silva@example.test', 'sent', 'msg_resend_demo_04', '2026-11-06 02:30:00+00');

