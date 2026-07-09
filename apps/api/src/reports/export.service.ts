import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';

const EMERALD = '#047857';
const GOLD = '#B8860B';

type GeneralData = {
  schools: { id: string; code: string; name: string; enrolled: number }[];
  rows: { surah: { number: number; name: string }; perSchool: Record<string, number>; total: number }[];
};

type StudentReport = Awaited<ReturnType<import('./reports.service').ReportsService['student']>>;

function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

@Injectable()
export class ExportService {
  // ---------- Excel ----------
  async generalXlsx(data: GeneralData, level: string): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = 'QPMS';
    const ws = wb.addWorksheet(`GENERAL ${level}`);

    const header = ['Surah', ...data.schools.map((s) => s.code), 'TOTAL'];
    ws.addRow([`QPMS — GENERAL roll-up · ${level}`]);
    ws.addRow([`Generated ${fmtDate(new Date())}`]);
    ws.addRow([]);
    const headerRow = ws.addRow(header);
    headerRow.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      c.alignment = { horizontal: 'center' };
    });

    for (const r of data.rows) {
      ws.addRow([`${r.surah.number}. ${r.surah.name}`, ...data.schools.map((s) => r.perSchool[s.id] ?? 0), r.total]);
    }
    ws.getColumn(1).width = 28;
    for (let i = 2; i <= header.length; i++) ws.getColumn(i).width = 8;
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];
    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async studentXlsx(rep: StudentReport): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = 'QPMS';
    const title = (ws: any, text: string) => {
      const row = ws.addRow([text]);
      row.font = { bold: true, size: 12, color: { argb: 'FF047857' } };
    };

    const info = wb.addWorksheet('Summary');
    title(info, `Student Report — ${rep.student.fullName}`);
    info.addRow([]);
    const pairs: [string, string | number][] = [
      ['Admission No', rep.student.admissionNo],
      ['School', `${rep.student.school} (${rep.student.schoolCode})`],
      ['Class', `${rep.student.className} · ${rep.student.level}`],
      ['Stream', rep.student.stream ?? '—'],
      ['Teacher', rep.student.teacher ?? '—'],
      ['Guardian', `${rep.student.guardianName ?? '—'} ${rep.student.guardianPhone ?? ''}`.trim()],
      ['Status', rep.student.status],
      ['', ''],
      ['Surahs memorized', `${rep.summary.memorized} / ${rep.summary.target} (${rep.summary.percent}%)`],
      ['Revisions', rep.summary.revisions],
      ['Assessments', rep.summary.assessments],
      ['Average score', rep.summary.avgScore ?? '—'],
      ['Total mistakes', rep.summary.mistakes],
    ];
    for (const [k, v] of pairs) {
      const row = info.addRow([k, v]);
      row.getCell(1).font = { bold: true };
    }
    info.getColumn(1).width = 22;
    info.getColumn(2).width = 36;

    const memo = wb.addWorksheet('Memorization');
    memo.addRow(['Surah', 'Juz', 'Ayah from', 'Ayah to', 'Date']).font = { bold: true };
    rep.memorizations.forEach((m) => memo.addRow([m.surah, m.juz, m.ayahFrom ?? '', m.ayahTo ?? '', fmtDate(m.date)]));
    memo.getColumn(1).width = 28;

    const rev = wb.addWorksheet('Revision');
    rev.addRow(['Surah / Juz', 'Score', 'Date']).font = { bold: true };
    rep.revisions.forEach((r) => rev.addRow([r.surah, r.score ?? '', fmtDate(r.date)]));
    rev.getColumn(1).width = 28;

    const ass = wb.addWorksheet('Assessment');
    ass.addRow(['Grade', 'Score', 'Date']).font = { bold: true };
    rep.assessments.forEach((a) => ass.addRow([a.grade ?? '', a.score ?? '', fmtDate(a.date)]));

    const att = wb.addWorksheet('Attendance');
    att.addRow(['Date', 'Status']).font = { bold: true };
    rep.attendances.forEach((a) => att.addRow([fmtDate(a.date), a.status]));

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // ---------- PDF ----------
  private renderPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      this.brandHeader(doc);
      build(doc);
      doc.end();
    });
  }

  private brandHeader(doc: PDFKit.PDFDocument) {
    doc.rect(0, 0, doc.page.width, 60).fill(EMERALD);
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text('QPMS', 40, 18);
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#D1FAE5')
      .text('Quran Progress & Memorization Management System', 40, 40);
    doc.fillColor('#000000').moveDown(2);
    doc.y = 80;
  }

  private sectionTitle(doc: PDFKit.PDFDocument, text: string) {
    doc.moveDown(0.6);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(EMERALD).text(text);
    doc.moveTo(40, doc.y + 2).lineTo(doc.page.width - 40, doc.y + 2).strokeColor(GOLD).lineWidth(1).stroke();
    doc.moveDown(0.4).fillColor('#000000').font('Helvetica').fontSize(9);
  }

  /** Simple fixed-column table. */
  private table(doc: PDFKit.PDFDocument, headers: string[], widths: number[], rows: (string | number)[][]) {
    const left = 40;
    const rowH = 16;
    const draw = (cells: (string | number)[], bold: boolean, fill?: string) => {
      if (doc.y + rowH > doc.page.height - 50) {
        doc.addPage();
        doc.y = 50;
      }
      const y = doc.y;
      if (fill) doc.rect(left, y, widths.reduce((a, b) => a + b, 0), rowH).fill(fill);
      doc.fillColor(bold ? '#FFFFFF' : '#111111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
      let x = left;
      cells.forEach((c, i) => {
        doc.text(String(c ?? ''), x + 4, y + 4, { width: widths[i] - 6, ellipsis: true, lineBreak: false });
        x += widths[i];
      });
      doc.y = y + rowH;
    };
    draw(headers, true, EMERALD);
    rows.forEach((r, i) => draw(r, false, i % 2 ? '#F3F4F6' : undefined));
  }

  async generalPdf(data: GeneralData, level: string): Promise<Buffer> {
    return this.renderPdf((doc) => {
      doc.fontSize(14).font('Helvetica-Bold').text(`GENERAL roll-up — ${level}`);
      doc.fontSize(9).font('Helvetica').fillColor('#6B7280').text(`Generated ${fmtDate(new Date())}`);
      doc.fillColor('#000000');
      this.sectionTitle(doc, 'Students who memorized each surah, per school');

      const codes = data.schools.map((s) => s.code);
      const surahW = 150;
      const totalW = 40;
      const avail = doc.page.width - 80 - surahW - totalW;
      const schoolW = Math.max(24, Math.floor(avail / Math.max(1, codes.length)));
      const headers = ['Surah', ...codes, 'TOT'];
      const widths = [surahW, ...codes.map(() => schoolW), totalW];
      const rows = data.rows.map((r) => [
        `${r.surah.number}. ${r.surah.name}`,
        ...data.schools.map((s) => r.perSchool[s.id] ?? 0),
        r.total,
      ]);
      this.table(doc, headers, widths, rows);
    });
  }

  async studentPdf(rep: StudentReport): Promise<Buffer> {
    return this.renderPdf((doc) => {
      doc.fontSize(15).font('Helvetica-Bold').text(rep.student.fullName);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(
          `${rep.student.school} · ${rep.student.className} (${rep.student.level})` +
            (rep.student.stream ? ` · ${rep.student.stream}` : '') +
            ` · Adm ${rep.student.admissionNo}`,
        );
      doc.fillColor('#000000');

      this.sectionTitle(doc, 'Summary');
      const s = rep.summary;
      const att = Object.entries(s.attendance).map(([k, v]) => `${k} ${v}`).join('  ') || '—';
      const lines = [
        `Memorized: ${s.memorized}/${s.target} surahs  (${s.percent}%)`,
        `Revisions: ${s.revisions}    Assessments: ${s.assessments}    Avg score: ${s.avgScore ?? '—'}`,
        `Total mistakes: ${s.mistakes}`,
        `Attendance: ${att}`,
        `Guardian: ${rep.student.guardianName ?? '—'} ${rep.student.guardianPhone ?? ''}`,
        `Teacher: ${rep.student.teacher ?? '—'}`,
      ];
      doc.fontSize(9.5).font('Helvetica');
      lines.forEach((l) => doc.text(l));

      this.sectionTitle(doc, `Memorization (${rep.memorizations.length})`);
      if (rep.memorizations.length) {
        this.table(
          doc,
          ['Surah', 'Juz', 'From', 'To', 'Date'],
          [200, 50, 50, 50, 100],
          rep.memorizations.map((m) => [m.surah, m.juz, m.ayahFrom ?? '', m.ayahTo ?? '', fmtDate(m.date)]),
        );
      } else doc.text('No records.');

      this.sectionTitle(doc, `Revision (${rep.revisions.length})`);
      if (rep.revisions.length) {
        this.table(
          doc,
          ['Surah / Juz', 'Score', 'Date'],
          [250, 80, 120],
          rep.revisions.map((r) => [r.surah, r.score ?? '', fmtDate(r.date)]),
        );
      } else doc.text('No records.');

      this.sectionTitle(doc, `Assessments (${rep.assessments.length})`);
      if (rep.assessments.length) {
        this.table(
          doc,
          ['Grade', 'Score', 'Date'],
          [200, 80, 120],
          rep.assessments.map((a) => [a.grade ?? '', a.score ?? '', fmtDate(a.date)]),
        );
      } else doc.text('No records.');
    });
  }
}
