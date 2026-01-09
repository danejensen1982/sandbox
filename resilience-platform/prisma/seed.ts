import 'dotenv/config';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ws from 'ws';

// Configure Neon for Node.js environment
neonConfig.webSocketConstructor = ws;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  // Pass connection string directly to adapter (not via Pool)
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrismaClient();
  console.log('Prisma client created');
  console.log('Seeding database...');

  // Create Likert scales
  console.log('Creating Likert scales...');
  const likert5Labels = [
    'Strongly Disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly Agree',
  ];

  for (let i = 0; i < 5; i++) {
    await prisma.likertScale.upsert({
      where: { scaleType_value: { scaleType: 'likert_5', value: i + 1 } },
      update: {},
      create: {
        scaleType: 'likert_5',
        value: i + 1,
        label: likert5Labels[i],
        displayOrder: i + 1,
      },
    });
  }

  // Create 7 Resilience Areas
  console.log('Creating resilience areas...');
  const areas = [
    {
      slug: 'emotional',
      name: 'Emotional Resilience',
      description: 'Your ability to manage emotions, cope with stress, and maintain psychological well-being.',
      iconName: 'heart',
      colorHex: '#E91E63',
    },
    {
      slug: 'physical',
      name: 'Physical Resilience',
      description: 'Your capacity to maintain physical health, energy, and recover from physical challenges.',
      iconName: 'activity',
      colorHex: '#4CAF50',
    },
    {
      slug: 'mental',
      name: 'Mental Resilience',
      description: 'Your cognitive flexibility, problem-solving abilities, and capacity for clear thinking under pressure.',
      iconName: 'brain',
      colorHex: '#2196F3',
    },
    {
      slug: 'social',
      name: 'Social Resilience',
      description: 'Your ability to build and maintain supportive relationships and navigate social challenges.',
      iconName: 'users',
      colorHex: '#9C27B0',
    },
    {
      slug: 'spiritual',
      name: 'Spiritual Resilience',
      description: 'Your sense of purpose, meaning, and connection to something greater than yourself.',
      iconName: 'sun',
      colorHex: '#FF9800',
    },
    {
      slug: 'professional',
      name: 'Professional Resilience',
      description: 'Your ability to handle workplace challenges, adapt to change, and maintain career satisfaction.',
      iconName: 'briefcase',
      colorHex: '#607D8B',
    },
    {
      slug: 'financial',
      name: 'Financial Resilience',
      description: 'Your capacity to manage financial stress and maintain stability through economic challenges.',
      iconName: 'dollar-sign',
      colorHex: '#795548',
    },
  ];

  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    const createdArea = await prisma.resilienceArea.upsert({
      where: { slug: area.slug },
      update: {},
      create: {
        ...area,
        displayOrder: i + 1,
      },
    });

    // Create score ranges for this area
    const scoreRanges = [
      { min: 0, max: 40, levelName: 'Developing', levelCode: 'developing', colorHex: '#FF6B6B' },
      { min: 40, max: 60, levelName: 'Emerging', levelCode: 'emerging', colorHex: '#FFE66D' },
      { min: 60, max: 80, levelName: 'Strong', levelCode: 'strong', colorHex: '#4ECDC4' },
      { min: 80, max: 101, levelName: 'Exceptional', levelCode: 'exceptional', colorHex: '#2ECC71' },
    ];

    for (const range of scoreRanges) {
      const existingRange = await prisma.scoreRange.findFirst({
        where: {
          resilienceAreaId: createdArea.id,
          levelCode: range.levelCode,
        },
      });

      if (!existingRange) {
        await prisma.scoreRange.create({
          data: {
            resilienceAreaId: createdArea.id,
            minScore: range.min,
            maxScore: range.max,
            levelName: range.levelName,
            levelCode: range.levelCode,
            colorHex: range.colorHex,
          },
        });
      }
    }

    // Create sample questions for this area (10 per area)
    const sampleQuestions = getSampleQuestions(area.slug);
    for (let j = 0; j < sampleQuestions.length; j++) {
      const existingQuestion = await prisma.question.findFirst({
        where: {
          resilienceAreaId: createdArea.id,
          displayOrder: j + 1,
        },
      });

      if (!existingQuestion) {
        await prisma.question.create({
          data: {
            resilienceAreaId: createdArea.id,
            questionText: sampleQuestions[j].text,
            questionType: 'likert_5',
            displayOrder: j + 1,
            isReverseScored: sampleQuestions[j].reverse || false,
            weight: 1,
          },
        });
      }
    }
  }

  // Create overall feedback content
  console.log('Creating overall feedback content...');
  const overallFeedback = [
    {
      min: 0,
      max: 40,
      type: 'summary',
      body: 'Your overall resilience profile indicates significant opportunities for growth. This is a starting point for building stronger foundations across multiple areas of your life.',
    },
    {
      min: 40,
      max: 60,
      type: 'summary',
      body: 'Your resilience profile shows emerging strength. You have developed some solid foundations and there are clear areas where focused attention can lead to meaningful improvement.',
    },
    {
      min: 60,
      max: 80,
      type: 'summary',
      body: 'You demonstrate strong resilience across multiple dimensions. Your profile shows well-developed coping strategies and adaptive capabilities that serve you well in challenging situations.',
    },
    {
      min: 80,
      max: 101,
      type: 'summary',
      body: 'Your exceptional resilience profile reflects outstanding personal development and adaptive capacity. You have cultivated robust resources across all areas of your life.',
    },
  ];

  for (const feedback of overallFeedback) {
    const existing = await prisma.overallFeedbackContent.findFirst({
      where: {
        minOverallScore: feedback.min,
        contentType: feedback.type,
      },
    });

    if (!existing) {
      await prisma.overallFeedbackContent.create({
        data: {
          minOverallScore: feedback.min,
          maxOverallScore: feedback.max,
          contentType: feedback.type,
          contentBody: feedback.body,
        },
      });
    }
  }

  // Create sample organization and admin user
  console.log('Creating sample organization and admin...');
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
    },
  });

  // Create platform owner admin
  const passwordHash = await bcrypt.hash('admin123!@#', 12);
  await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      firstName: 'Platform',
      lastName: 'Admin',
      role: 'platform_owner',
    },
  });

  // Create org admin
  await prisma.adminUser.upsert({
    where: { email: 'orgadmin@example.com' },
    update: {},
    create: {
      email: 'orgadmin@example.com',
      passwordHash,
      firstName: 'Org',
      lastName: 'Admin',
      role: 'org_admin',
      organizationId: org.id,
    },
  });

  // Create sample cohort
  const cohort = await prisma.cohort.upsert({
    where: {
      id: 'demo-cohort',
    },
    update: {},
    create: {
      id: 'demo-cohort',
      organizationId: org.id,
      name: 'Leadership Cohort 2025',
      description: 'Annual leadership development program participants',
      allowRetakes: true,
      maxRetakes: 3,
      retakeCooldownDays: 30,
    },
  });

  console.log('Database seeded successfully!');
  console.log('');
  console.log('Sample login credentials:');
  console.log('  Platform Admin: admin@example.com / admin123!@#');
  console.log('  Org Admin: orgadmin@example.com / admin123!@#');
  console.log('');
  console.log('To generate assessment codes, log in as an admin and create codes for the demo cohort.');

  await prisma.$disconnect();
}

function getSampleQuestions(areaSlug: string): Array<{ text: string; reverse?: boolean }> {
  const questions: Record<string, Array<{ text: string; reverse?: boolean }>> = {
    emotional: [
      { text: 'I can identify and name my emotions accurately.' },
      { text: 'I recover quickly from disappointments and setbacks.' },
      { text: 'I maintain composure under pressure.' },
      { text: 'I struggle to manage my emotions effectively.', reverse: true },
      { text: 'I can calm myself when feeling anxious or upset.' },
      { text: 'I bounce back from criticism without dwelling on it.' },
      { text: 'I feel overwhelmed by my emotions frequently.', reverse: true },
      { text: 'I can express my emotions in healthy ways.' },
      { text: 'I maintain emotional balance during stressful periods.' },
      { text: 'I am comfortable asking for emotional support when needed.' },
    ],
    physical: [
      { text: 'I maintain a regular exercise routine.' },
      { text: 'I get adequate sleep most nights.' },
      { text: 'I eat a balanced, nutritious diet.' },
      { text: 'I often feel physically exhausted.', reverse: true },
      { text: 'I take breaks and rest when my body needs it.' },
      { text: 'I have good energy levels throughout the day.' },
      { text: 'I neglect my physical health when busy.', reverse: true },
      { text: 'I recover quickly from illness or physical strain.' },
      { text: 'I manage chronic health conditions effectively.' },
      { text: 'I prioritize preventive health care.' },
    ],
    mental: [
      { text: 'I can think clearly under pressure.' },
      { text: 'I adapt my approach when initial strategies don\'t work.' },
      { text: 'I maintain focus despite distractions.' },
      { text: 'I often feel mentally foggy or overwhelmed.', reverse: true },
      { text: 'I approach problems with creativity and flexibility.' },
      { text: 'I learn from mistakes rather than dwell on them.' },
      { text: 'I struggle to make decisions under stress.', reverse: true },
      { text: 'I can see situations from multiple perspectives.' },
      { text: 'I remain curious and open to new information.' },
      { text: 'I manage negative thought patterns effectively.' },
    ],
    social: [
      { text: 'I have supportive relationships I can count on.' },
      { text: 'I communicate effectively even in difficult conversations.' },
      { text: 'I set healthy boundaries in relationships.' },
      { text: 'I often feel isolated or disconnected.', reverse: true },
      { text: 'I can ask for help when I need it.' },
      { text: 'I maintain important relationships during busy times.' },
      { text: 'I avoid conflict even when issues need addressing.', reverse: true },
      { text: 'I contribute positively to my community.' },
      { text: 'I can navigate workplace relationships effectively.' },
      { text: 'I build new connections with relative ease.' },
    ],
    spiritual: [
      { text: 'I have a clear sense of purpose in my life.' },
      { text: 'My values guide my decision-making.' },
      { text: 'I find meaning in challenging experiences.' },
      { text: 'I often feel disconnected from what matters most.', reverse: true },
      { text: 'I engage in practices that nurture my inner life.' },
      { text: 'I feel connected to something larger than myself.' },
      { text: 'I struggle to find meaning in my daily activities.', reverse: true },
      { text: 'I maintain perspective during difficult times.' },
      { text: 'My beliefs provide comfort and strength.' },
      { text: 'I reflect regularly on what gives my life meaning.' },
    ],
    professional: [
      { text: 'I handle workplace stress effectively.' },
      { text: 'I adapt well to organizational changes.' },
      { text: 'I maintain boundaries between work and personal life.' },
      { text: 'I feel burned out or exhausted by work.', reverse: true },
      { text: 'I continue developing my professional skills.' },
      { text: 'I recover quickly from professional setbacks.' },
      { text: 'Work challenges feel overwhelming.', reverse: true },
      { text: 'I navigate workplace politics effectively.' },
      { text: 'I find satisfaction in my professional contributions.' },
      { text: 'I advocate for myself professionally.' },
    ],
    financial: [
      { text: 'I have savings to cover unexpected expenses.' },
      { text: 'I manage my finances with a clear plan.' },
      { text: 'I feel confident in my financial decisions.' },
      { text: 'Financial stress significantly impacts my well-being.', reverse: true },
      { text: 'I have strategies for managing financial uncertainty.' },
      { text: 'I can discuss money matters without excessive anxiety.' },
      { text: 'I avoid looking at my financial situation.', reverse: true },
      { text: 'I balance current needs with future financial goals.' },
      { text: 'I can adapt my spending when circumstances change.' },
      { text: 'I feel in control of my financial future.' },
    ],
  };

  return questions[areaSlug] || [];
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
