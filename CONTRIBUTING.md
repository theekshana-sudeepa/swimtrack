# Contributing to SwimTrack

Thank you for your interest in contributing to SwimTrack!

SwimTrack is a personal, non-commercial open-source web application designed for recording squad swimming attendance, scheduling pool sessions, and viewing participation analytics.

## Development Workflow

### 1. Prerequisites
- Node.js 20+ (Node 22 recommended)
- npm 10+
- Git

### 2. Local Setup
```bash
git clone https://github.com/theekshana-sudeepa/SwimTrack.git
cd SwimTrack
npm install
npm run dev
```

The application will run immediately in local standalone demo mode at `http://localhost:3000`. Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.local` (copied from `.env.example`) to sign into the Admin Control Room.

### 3. Running Checks
Before submitting a pull request, ensure all verification checks pass:

```bash
# Run ESLint
npm run lint

# Run TypeScript validation
npm run typecheck

# Run Unit & Integration tests
npm run test

# Run Playwright E2E browser tests
npm run test:e2e

# Verify production build
npm run build
```

## Pull Request Guidelines

1. **Focus on Core Experience**: Prioritize attendance marking speed, responsive mobile touch targets, and data integrity over complex enterprise features.
2. **No Commercial Features**: Do not submit pull requests introducing monetization, checkout pages, or third-party ads.
3. **Privacy First**: Never commit real personal emails or phone numbers to test suites or seeds. Fictional demonstration data only.
4. **Code Quality**: Write typed, clean TypeScript with strict null checks.

