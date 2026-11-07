# Changelog

All notable changes to **SwimTrack** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-07

### Added
- Complete rewrite with Next.js 15 App Router, React 19, and TypeScript strict mode.
- Original "Aquatic Control Room" design system with deep ocean (#071B2B), navy (#102A3B), aqua (#22C7D8), seafoam (#5BE6CD), and light surface (#F2FAFC).
- High-speed Attendance Command Center with optimistic UI, rollback handling, and keyboard shortcuts (`P`, `A`, `L`, `E`, `U`).
- Bulk attendance actions (`Mark All Present`, `Mark Remaining Absent` with safety confirmations).
- Swimmers roster management with search, filter, CSV export, and individual profiles featuring participation streaks and milestones.
- Session scheduling engine supporting single practices and recurring weekly series.
- Resend and React Email integration with atomic claim keys, duplicate protection, and opt-out support.
- Mathematical analytics engine calculating true attendance percentage (`(Present + Late) / Eligible * 100`).
- Responsive mobile navigation bar and desktop sidebar.
- Vercel Cron handler for daily morning reminders (~8:00 AM Asia/Colombo).
- Full Vitest unit test suite and Playwright browser E2E test suite.
- Comprehensive technical documentation and real application screenshots.

