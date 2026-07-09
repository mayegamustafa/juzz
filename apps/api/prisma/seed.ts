import { PrismaClient, Role, Gender } from '@prisma/client';
import * as argon2 from 'argon2';
import { SURAHS, juzForSurah } from './surahs';

const prisma = new PrismaClient();

// 11 schools from the SAK QURAN TARGETS workbook (tab code -> full name)
const SCHOOLS: { code: string; name: string }[] = [
  { code: 'CPS', name: 'City Parents School' },
  { code: 'MEN', name: 'Mengo' },
  { code: 'KIS', name: 'Kisaasi' },
  { code: 'OK', name: 'OK' },
  { code: 'WIN', name: 'Winston' },
  { code: 'NAK', name: 'Nakasero' },
  { code: 'KIT', name: 'Kitintale' },
  { code: 'KPS', name: 'KPS' },
  { code: 'KPM', name: 'KPM' },
  { code: 'FWAY', name: 'Fairways' },
  { code: 'KIRA', name: 'Kira' },
];

const CLASS_LEVELS = ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'];

// Real CPS P.1 students (name, sheikh, surahs-memorized-count from #114 downwards)
const CPS_P1: { name: string; sheikh: string; memo: number }[] = [
  { name: 'KYAGULANYI REHAN', sheikh: 'NYOMBI', memo: 9 },
  { name: 'JUMBA TAHIR', sheikh: 'NYOMBI', memo: 9 },
  { name: 'MATOVU SHAN', sheikh: 'NYOMBI', memo: 4 },
  { name: 'LUSWA ADNAN', sheikh: 'NYOMBI', memo: 7 },
  { name: 'ABIR MUHAMMED', sheikh: 'NYOMBI', memo: 8 },
  { name: 'SEMUJJU YASIN', sheikh: 'NYOMBI', memo: 9 },
  { name: 'WAKOOLI LYDEN', sheikh: 'NYOMBI', memo: 14 },
  { name: 'NAMIREMBE TAHIRA', sheikh: 'NYOMBI', memo: 5 },
  { name: 'MUBIRU IHSAN', sheikh: 'NYOMBI', memo: 4 },
  { name: 'MATOVU KAUTHAR', sheikh: 'NYOMBI', memo: 4 },
  { name: 'SSESANGA MALIK', sheikh: 'NYOMBI', memo: 6 },
  { name: 'ALIYA MPOZI', sheikh: 'NYOMBI', memo: 6 },
  { name: 'IMAAMA HAMID', sheikh: 'NAWIIRA', memo: 12 },
  { name: 'NALUKWAATA RAHMA', sheikh: 'NAWIIRA', memo: 12 },
  { name: 'NAGAWA RIANA', sheikh: 'NAWIIRA', memo: 12 },
  { name: 'DAWOOD IBRAHIM', sheikh: 'NAWIIRA', memo: 13 },
  { name: 'AMAL SANIA', sheikh: 'NAWIIRA', memo: 4 },
  { name: 'NALUWOOZA TAHRA', sheikh: 'NAWIIRA', memo: 7 },
  { name: 'ALMA ARIANA', sheikh: 'KAMBA', memo: 4 },
  { name: 'ABRIIR MUHAMMED', sheikh: 'KAMBA', memo: 7 },
  { name: 'NABICU RANIA', sheikh: 'KAMBA', memo: 4 },
  { name: 'BAHIL ABDUL', sheikh: 'KAMBA', memo: 9 },
  { name: 'MUSOKE SADALA', sheikh: 'MUGABO', memo: 4 },
];

const CPS_SHEIKHS = ['NYOMBI', 'NAWIIRA', 'KAMBA', 'MUGABO'];

async function main() {
  console.log('Seeding QPMS...');

  // --- Organization ---
  const org = await prisma.organization.upsert({
    where: { code: 'SAK' },
    update: {},
    create: { code: 'SAK', name: 'Sir Apollo Kaggwa Schools & City Parents School' },
  });

  // --- Surahs (114) ---
  for (const [number, nameArabic, nameTransliteration, ayahCount] of SURAHS) {
    await prisma.surah.upsert({
      where: { number },
      update: { nameArabic, nameTransliteration, ayahCount, juz: juzForSurah(number) },
      create: { number, nameArabic, nameTransliteration, ayahCount, juz: juzForSurah(number) },
    });
  }
  console.log(`  surahs: ${SURAHS.length}`);

  // --- Schools + classes ---
  const schoolByCode: Record<string, string> = {};
  for (const s of SCHOOLS) {
    const school = await prisma.school.upsert({
      where: { organizationId_code: { organizationId: org.id, code: s.code } },
      update: { name: s.name },
      create: { organizationId: org.id, code: s.code, name: s.name, location: 'Uganda' },
    });
    schoolByCode[s.code] = school.id;
    for (let i = 0; i < CLASS_LEVELS.length; i++) {
      await prisma.schoolClass.upsert({
        where: { schoolId_level: { schoolId: school.id, level: CLASS_LEVELS[i] } },
        update: {},
        create: { schoolId: school.id, level: CLASS_LEVELS[i], name: CLASS_LEVELS[i], order: i },
      });
    }
  }
  console.log(`  schools: ${SCHOOLS.length} (x${CLASS_LEVELS.length} classes each)`);

  // --- Term + 2-Juzu target ---
  const term = await prisma.term.upsert({
    where: { id: 'seed-term-t3-2025' },
    update: {},
    create: {
      id: 'seed-term-t3-2025',
      organizationId: org.id,
      name: 'Term 3 2025',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-05'),
      isActive: true,
    },
  });
  await prisma.target.upsert({
    where: { id: 'seed-target-2juz' },
    update: {},
    create: {
      id: 'seed-target-2juz',
      termId: term.id,
      scope: 'ORGANIZATION',
      organizationId: org.id,
      unit: 'JUZ',
      amount: 2,
      description: 'Memorize 2 Juzu (Juzu Amma + Juzu Tabaraka, surahs 67-114)',
    },
  });
  console.log('  term + 2-Juzu target');

  // --- Teachers for CPS ---
  const cpsId = schoolByCode['CPS'];
  const teacherByName: Record<string, string> = {};
  for (const name of CPS_SHEIKHS) {
    const existing = await prisma.teacher.findFirst({ where: { schoolId: cpsId, fullName: name } });
    const t =
      existing ??
      (await prisma.teacher.create({ data: { schoolId: cpsId, fullName: name } }));
    teacherByName[name] = t.id;
  }

  // --- CPS P.1 students + memorization (top N surahs from #114 downward) ---
  const p1 = await prisma.schoolClass.findFirst({ where: { schoolId: cpsId, level: 'P.1' } });
  const surahs = await prisma.surah.findMany({ orderBy: { number: 'desc' } }); // 114..1
  let studentCount = 0;
  for (let i = 0; i < CPS_P1.length; i++) {
    const s = CPS_P1[i];
    const admissionNo = `CPS-P1-${String(i + 1).padStart(3, '0')}`;
    const student = await prisma.student.upsert({
      where: { schoolId_admissionNo: { schoolId: cpsId, admissionNo } },
      update: { fullName: s.name, primaryTeacherId: teacherByName[s.sheikh] },
      create: {
        schoolId: cpsId,
        classId: p1!.id,
        admissionNo,
        fullName: s.name,
        gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        primaryTeacherId: teacherByName[s.sheikh],
        status: 'ACTIVE',
      },
    });
    studentCount++;
    // memorized the first `memo` surahs counting down from 114
    for (let k = 0; k < s.memo && k < surahs.length; k++) {
      const surah = surahs[k];
      await prisma.memorizationRecord.upsert({
        where: { studentId_surahId: { studentId: student.id, surahId: surah.id } },
        update: {},
        create: { studentId: student.id, surahId: surah.id, fraction: 1 },
      });
    }
  }
  console.log(`  CPS P.1 students: ${studentCount} (with memorization records)`);

  // --- Users ---
  // The organisation runs its schools from a central secretariat: the manager (EMT)
  // is a SUPERVISOR with org-wide powers. There are no per-school administrators.
  const pwd = await argon2.hash('Password123!');
  const users: { email: string; role: Role; fullName: string; schoolId?: string }[] = [
    { email: 'superadmin@qpms.test', role: Role.SUPER_ADMIN, fullName: 'Super Admin' },
    { email: 'supervisor@qpms.test', role: Role.SUPERVISOR, fullName: 'Secretariat Manager' },
    { email: 'manager@qpms.test', role: Role.SUPERVISOR, fullName: 'EMT Manager' },
    { email: 'nyombi@qpms.test', role: Role.TEACHER, fullName: 'Sheikh Nyombi', schoolId: cpsId },
  ];
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, fullName: u.fullName, schoolId: u.schoolId ?? null },
      create: {
        organizationId: org.id,
        schoolId: u.schoolId ?? null,
        role: u.role,
        fullName: u.fullName,
        email: u.email,
        passwordHash: pwd,
      },
    });
    // link the teacher user to the NYOMBI teacher record
    if (u.role === Role.TEACHER) {
      await prisma.teacher.update({
        where: { id: teacherByName['NYOMBI'] },
        data: { userId: user.id },
      });
    }
  }

  console.log('\nSeed complete. Demo logins (password: Password123!):');
  for (const u of users) console.log(`  ${u.role.padEnd(13)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
