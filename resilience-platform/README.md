# Resilience Assessment Platform

A secure, SOC 2 compliant platform for administering self-assessments focused on personal resilience to leaders in large organizations.

## Features

- **Unique Code-Based Access**: Users receive unique codes or links to access their assessment
- **7 Resilience Areas**: Configurable assessment areas (Emotional, Physical, Mental, Social, Spiritual, Professional, Financial)
- **Likert Scale Questions**: 10-20 questions per area with weighted scoring and reverse-score support
- **Personalized Results**: Beautiful results dashboard with radar charts, score bars, and tailored feedback
- **PDF Export**: Download results as a PDF report
- **Persistent Results Access**: Users can return to view their results anytime using their code
- **Admin Portal**: Manage cohorts, generate codes, view aggregate analytics (no individual data)
- **Platform Owner Portal**: Configure questions, scoring rubrics, and feedback content
- **SOC 2 Compliant**: Encryption at rest/transit, audit logging, privacy-preserving analytics

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (designed for Neon)
- **ORM**: Prisma
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **PDF**: jsPDF + html2canvas
- **Auth**: JWT with bcrypt password hashing

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or Neon)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   # Edit .env with your database URL and secrets:
   DATABASE_URL="postgresql://user:password@host:5432/resilience_platform"
   JWT_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32
   JWT_REFRESH_SECRET="another-secret-here"
   ENCRYPTION_KEY="your-encryption-key"
   ```

3. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

4. Push database schema:
   ```bash
   npm run db:push
   ```

5. Seed the database with sample data:
   ```bash
   npm run db:seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

### Sample Login Credentials

After seeding the database:

- **Platform Admin**: admin@example.com / admin123!@#
- **Org Admin**: orgadmin@example.com / admin123!@#

## Project Structure

```
src/
├── app/
│   ├── assess/           # Code entry & direct links
│   ├── assessment/       # Assessment flow
│   ├── results/          # Results dashboard
│   ├── admin/            # Admin portal
│   │   ├── login/
│   │   └── cohorts/
│   ├── platform/         # Platform owner portal
│   └── api/v1/           # REST API endpoints
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── assessment/       # Assessment components
│   ├── results/          # Results components
│   └── admin/            # Admin components
└── lib/
    ├── auth/             # Authentication utilities
    ├── scoring/          # Scoring engine
    ├── audit/            # Audit logging
    └── db.ts             # Prisma client
```

## User Flows

### Assessment Taker
1. Enter code at `/assess` or use direct link `/assess/[token]`
2. Complete questions across 7 resilience areas
3. View personalized results with charts and feedback
4. Download PDF report
5. Return anytime to view results using same code

### Organization Admin
1. Login at `/admin/login`
2. Create and manage cohorts
3. Generate assessment codes (bulk CSV download)
4. View aggregate analytics (minimum 5 completions for privacy)
5. Control retake permissions

### Platform Owner
1. Login with platform_owner role
2. Configure resilience areas and questions
3. Define score ranges and levels
4. Author feedback content (markdown supported)
5. Manage organizations and admin users

## Security Features

- **Encryption at rest**: Database-level encryption (Neon TDE)
- **Encryption in transit**: HTTPS/TLS required
- **Password hashing**: bcrypt with 12 rounds
- **JWT authentication**: Short-lived access tokens, refresh tokens
- **Audit logging**: All admin actions logged
- **Privacy threshold**: Analytics require 5+ responses
- **No PII in logs**: Event data never includes personal information

## Database Commands

```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations (development)
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio
```

## Content Configuration

The platform supports fully configurable content:

### Questions
- Add/edit questions via Platform Owner portal
- Support for reverse-scored questions
- Configurable question weights
- Optional help text per question

### Scoring
- Define score ranges per resilience area (e.g., 0-40 = Developing)
- Custom level names and colors
- Weighted scoring across questions

### Feedback
- Author feedback content per score range
- Markdown supported
- Content types: summary, strengths, growth areas, recommendations

## Deployment

Designed for Vercel + Neon PostgreSQL:

1. Create a Neon PostgreSQL database
2. Deploy to Vercel
3. Configure environment variables in Vercel dashboard
4. Run database migration and seed

## License

Private - All rights reserved
