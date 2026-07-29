import { Injectable } from '@nestjs/common';
import { Workbook, Worksheet } from 'exceljs';
import PDFDocument from 'pdfkit';

import {
  APP_NAME,
  ORG_NAME,
  LETTERHEAD_TITLE,
  LETTERHEAD_MOTTO,
  LETTERHEAD_DEPARTMENT,
  letterheadSchoolLine,
  copyrightLine,
  EMERALD,
  EMERALD_DARK,
  GOLD,
  GREY,
  ZEBRA,
  INK,
  logosSmall,
  fmtDate,
  fmtDateTime,
} from './brand';

/** Image handles embedded once per PDF document and reused on every page. */
type PdfMarks = { sak: unknown | null; cps: unknown | null };

type GeneralData = {
  schools: { id: string; code: string; name: string; enrolled: number }[];
  rows: { surah: { number: number; name: string }; perSchool: Record<string, number>; total: number }[];
};

type StudentReport = Awaited<ReturnType<import('./reports.service').ReportsService['student']>>;

const MARGIN = 40;
const HEADER_H = 108;
const FOOTER_H = 34;

@Injectable()
export class ExportService {
  // ==================== Excel ====================

  /** Embeds each crest once per workbook; every sheet's `xlsxHeader` reuses the same id. */
  private embedLogos(wb: Workbook): { sakId: number | null; cpsId: number | null } {
    const { sak, cps } = logosSmall();
    return {
      sakId: sak ? wb.addImage({ buffer: sak as any, extension: 'png' }) : null,
      cpsId: cps ? wb.addImage({ buffer: cps as any, extension: 'png' }) : null,
    };
  }

  /**
   * The official letterhead (org name, motto, department, school) followed by
   * this specific report's title. Every exported sheet starts with it.
   */
  private xlsxHeader(
    ws: Worksheet,
    logoIds: { sakId: number | null; cpsId: number | null },
    title: string,
    subtitle?: string,
    schoolName?: string | null,
  ) {
    if (logoIds.sakId !== null) {
      ws.addImage(logoIds.sakId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 46, height: 46 } });
    }
    if (logoIds.cpsId !== null) {
      ws.addImage(logoIds.cpsId, { tl: { col: 0.85, row: 0.1 }, ext: { width: 46, height: 46 } });
    }

    ws.getRow(1).height = 22;
    ws.getRow(2).height = 16;
    ws.getRow(3).height = 15;
    ws.getRow(4).height = 15;

    ws.getCell('C1').value = LETTERHEAD_TITLE;
    ws.getCell('C1').font = { bold: true, size: 15, color: { argb: 'FF065F46' } };

    ws.getCell('C2').value = LETTERHEAD_MOTTO;
    ws.getCell('C2').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } };

    ws.getCell('C3').value = LETTERHEAD_DEPARTMENT;
    ws.getCell('C3').font = { bold: true, size: 9, color: { argb: 'FFB8860B' } };

    ws.getCell('C4').value = letterheadSchoolLine(schoolName);
    ws.getCell('C4').font = { bold: true, size: 9, color: { argb: 'FF111111' } };

    ws.addRow([]);

    const t = ws.addRow([]);
    t.getCell(1).value = title;
    t.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF047857' } };

    const s = ws.addRow([]);
    s.getCell(1).value = subtitle ?? '';
    s.getCell(1).font = { size: 9, color: { argb: 'FF6B7280' } };

    const g = ws.addRow([]);
    g.getCell(1).value = `${copyrightLine()} · generated ${fmtDateTime(new Date())}`;
    g.getCell(1).font = { size: 8, italic: true, color: { argb: 'FF9CA3AF' } };

    ws.addRow([]);
    ws.addRow([]);
  }

  private styleHeaderRow(ws: Worksheet, rowNumber: number, cols: number) {
    const row = ws.getRow(rowNumber);
    for (let i = 1; i <= cols; i++) {
      const c = row.getCell(i);
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { bottom: { style: 'thin', color: { argb: 'FFB8860B' } } };
    }
    row.height = 18;
  }

  async generalXlsx(data: GeneralData, level: string): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = APP_NAME;
    wb.created = new Date();

    const ws = wb.addWorksheet(`GENERAL ${level}`, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    const schoolName = data.schools.length === 1 ? data.schools[0].name : undefined;
    const logoIds = this.embedLogos(wb);
    this.xlsxHeader(ws, logoIds, `GENERAL roll-up: ${level}`, 'Pupils who have memorized each surah, per school', schoolName);

    const header = ['Surah', ...data.schools.map((s) => s.code), 'TOTAL'];
    const headerRow = ws.addRow(header);
    this.styleHeaderRow(ws, headerRow.number, header.length);

    for (const r of data.rows) {
      const row = ws.addRow([
        `${r.surah.number}. ${r.surah.name}`,
        ...data.schools.map((s) => r.perSchool[s.id] ?? 0),
        r.total,
      ]);
      row.getCell(header.length).font = { bold: true };
      for (let i = 2; i <= header.length; i++) row.getCell(i).alignment = { horizontal: 'center' };
    }

    // Enrolment context under the table so the counts can be read as a ratio.
    ws.addRow([]);
    const enrol = ws.addRow(['Enrolled', ...data.schools.map((s) => s.enrolled), '']);
    enrol.font = { italic: true, color: { argb: 'FF6B7280' } };

    ws.getColumn(1).width = 28;
    for (let i = 2; i <= header.length; i++) ws.getColumn(i).width = 9;
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: headerRow.number }];
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: header.length } };

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  async studentXlsx(rep: StudentReport): Promise<Buffer> {
    const wb = new Workbook();
    wb.creator = APP_NAME;
    wb.created = new Date();

    const logoIds = this.embedLogos(wb);

    // --- Summary ---
    const info = wb.addWorksheet('Summary');
    this.xlsxHeader(
      info,
      logoIds,
      `Pupil Report: ${rep.student.fullName}`,
      `${rep.student.school} · ${rep.student.level}`,
      rep.student.school,
    );

    const pairs: [string, string | number][] = [
      ['Admission No', rep.student.admissionNo],
      ['School', `${rep.student.school} (${rep.student.schoolCode})`],
      ['Class', `${rep.student.className} · ${rep.student.level}`],
      ['Stream', rep.student.stream ?? 'N/A'],
      ['Sheikh', rep.student.teacher ?? 'N/A'],
      ['Guardian', `${rep.student.guardianName ?? 'N/A'} ${rep.student.guardianPhone ?? ''}`.trim()],
      ['Status', rep.student.status],
      ['', ''],
      ['Surahs memorized', `${rep.summary.memorized} / ${rep.summary.target} (${rep.summary.percent}%)`],
      ['Revisions', rep.summary.revisions],
      ['Assessments', rep.summary.assessments],
      ['Average score', rep.summary.avgScore ?? 'N/A'],
      ['Total mistakes', rep.summary.mistakes],
    ];
    for (const [k, v] of pairs) {
      const row = info.addRow([k, v]);
      row.getCell(1).font = { bold: true };
    }
    info.getColumn(1).width = 22;
    info.getColumn(2).width = 40;

    const sheet = (name: string, headers: string[], rows: (string | number)[][], widths: number[]) => {
      const ws = wb.addWorksheet(name);
      this.xlsxHeader(ws, logoIds, `${name}: ${rep.student.fullName}`, undefined, rep.student.school);
      const hr = ws.addRow(headers);
      this.styleHeaderRow(ws, hr.number, headers.length);
      rows.forEach((r) => ws.addRow(r));
      widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
      ws.views = [{ state: 'frozen', ySplit: hr.number }];
    };

    sheet(
      'Memorization',
      ['Surah', 'Juz', 'Ayah from', 'Ayah to', 'Date'],
      rep.memorizations.map((m) => [m.surah, m.juz, m.ayahFrom ?? '', m.ayahTo ?? '', fmtDate(m.date)]),
      [28, 8, 12, 12, 16],
    );
    sheet(
      'Revision',
      ['Surah / Juz', 'Score', 'Date'],
      rep.revisions.map((r) => [r.surah, r.score ?? '', fmtDate(r.date)]),
      [28, 10, 16],
    );
    sheet(
      'Assessment',
      ['Grade', 'Score', 'Date'],
      rep.assessments.map((a) => [a.grade ?? '', a.score ?? '', fmtDate(a.date)]),
      [18, 10, 16],
    );
    sheet(
      'Attendance',
      ['Date', 'Status'],
      rep.attendances.map((a) => [fmtDate(a.date), a.status]),
      [16, 16],
    );

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  // ==================== PDF ====================

  /**
   * `bufferPages` lets us stamp footers after the body is laid out, once the
   * total page count is known.
   */
  private renderPdf(
    build: (doc: PDFKit.PDFDocument) => void,
    opts: { landscape?: boolean; schoolName?: string | null } = {},
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: opts.landscape ? 'landscape' : 'portrait',
        margin: MARGIN,
        bufferPages: true,
        info: { Title: APP_NAME, Author: ORG_NAME },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Embed each crest once and reuse the handle. Calling doc.image(buffer)
      // per page re-embeds the bytes and bloats a 4-page report to ~1.4 MB.
      // `openImage` exists in pdfkit but is missing from @types/pdfkit.
      const open = (doc as unknown as { openImage(b: Buffer): unknown }).openImage.bind(doc);
      const small = logosSmall();
      const marks: PdfMarks = {
        sak: small.sak ? open(small.sak) : null,
        cps: small.cps ? open(small.cps) : null,
      };

      // Every page gets the brand band, including ones pdfkit adds implicitly.
      doc.on('pageAdded', () => this.pdfHeader(doc, marks, opts.schoolName));
      this.pdfHeader(doc, marks, opts.schoolName);

      build(doc);
      this.pdfFooters(doc);
      doc.end();
    });
  }

  /**
   * The organisation's letterhead: title, motto, department and the specific
   * school this document is about (or "All Schools" for an org-wide report).
   */
  private pdfHeader(doc: PDFKit.PDFDocument, marks: PdfMarks, schoolName?: string | null) {
    const { sak, cps } = marks;
    const w = doc.page.width;
    const textLeft = MARGIN + 66;
    const textWidth = w - 2 * MARGIN - 132;

    doc.save();
    doc.rect(0, 0, w, HEADER_H).fill(EMERALD);
    doc.rect(0, HEADER_H - 3, w, 3).fill(GOLD);

    // Crests sit on white chips: both are crimson and vanish against emerald.
    const chipY = (HEADER_H - 58) / 2;
    if (sak) {
      doc.roundedRect(MARGIN, chipY, 58, 58, 7).fill('#FFFFFF');
      doc.image(sak as any, MARGIN + 5, chipY + 5, { fit: [48, 48] });
    }
    if (cps) {
      doc.roundedRect(w - MARGIN - 58, chipY, 58, 58, 7).fill('#FFFFFF');
      doc.image(cps as any, w - MARGIN - 53, chipY + 5, { fit: [48, 48] });
    }

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(LETTERHEAD_TITLE, textLeft, 14, { width: textWidth, align: 'center' });
    doc
      .font('Helvetica-Oblique')
      .fontSize(8.5)
      .fillColor('#D1FAE5')
      .text(LETTERHEAD_MOTTO, textLeft, 32, { width: textWidth, align: 'center' });
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#FDE9B8')
      .text(LETTERHEAD_DEPARTMENT, textLeft, 47, { width: textWidth, align: 'center', characterSpacing: 0.5 });
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#FFFFFF')
      .text(letterheadSchoolLine(schoolName), textLeft, 62, { width: textWidth, align: 'center' });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#D1FAE5')
      .text(APP_NAME, textLeft, 82, { width: textWidth, align: 'center' });

    doc.restore();
    doc.fillColor(INK);
    doc.x = MARGIN;
    doc.y = HEADER_H + 16;
  }

  /** Page numbers + timestamp, stamped once the page count is final. */
  private pdfFooters(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange();
    const generated = fmtDateTime(new Date());

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const w = doc.page.width;
      const h = doc.page.height;

      // The footer sits below the bottom margin. pdfkit would treat that as an
      // overflow and silently append a blank page, so suspend the margin while
      // we write into the footer band.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc.save();
      doc
        .moveTo(MARGIN, h - FOOTER_H)
        .lineTo(w - MARGIN, h - FOOTER_H)
        .strokeColor('#E5E7EB')
        .lineWidth(0.5)
        .stroke();

      doc.font('Helvetica').fontSize(7.5).fillColor(GREY);
      doc.text(`${copyrightLine()} · generated ${generated}`, MARGIN, h - FOOTER_H + 11, { lineBreak: false });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, w - MARGIN - 120, h - FOOTER_H + 11, {
        width: 120,
        align: 'right',
        lineBreak: false,
      });
      doc.restore();

      doc.page.margins.bottom = bottomMargin;
    }
  }

  private sectionTitle(doc: PDFKit.PDFDocument, text: string) {
    if (doc.y + 40 > doc.page.height - FOOTER_H - 10) doc.addPage();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(EMERALD_DARK).text(text, MARGIN, doc.y);
    const y = doc.y + 2;
    doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).strokeColor(GOLD).lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fillColor(INK).font('Helvetica').fontSize(9);
  }

  /** Fixed-column table. Headers repeat on every page it spills onto. */
  private table(
    doc: PDFKit.PDFDocument,
    headers: string[],
    widths: number[],
    rows: (string | number)[][],
    align: ('left' | 'center')[] = [],
  ) {
    const rowH = 15.5;
    const tableW = widths.reduce((a, b) => a + b, 0);
    const bottom = doc.page.height - FOOTER_H - 8;

    const drawRow = (cells: (string | number)[], header: boolean, zebra = false) => {
      const y = doc.y;
      if (header) {
        doc.rect(MARGIN, y, tableW, rowH).fill(EMERALD);
      } else if (zebra) {
        doc.rect(MARGIN, y, tableW, rowH).fill(ZEBRA);
      }
      doc
        .fillColor(header ? '#FFFFFF' : INK)
        .font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8);

      let x = MARGIN;
      cells.forEach((c, i) => {
        doc.text(String(c ?? ''), x + 4, y + 4.5, {
          width: widths[i] - 8,
          align: align[i] ?? (i === 0 ? 'left' : 'center'),
          ellipsis: true,
          lineBreak: false,
        });
        x += widths[i];
      });
      doc.y = y + rowH;
    };

    drawRow(headers, true);
    rows.forEach((r, i) => {
      if (doc.y + rowH > bottom) {
        doc.addPage(); // pageAdded re-draws the header band and resets doc.y
        drawRow(headers, true);
      }
      drawRow(r, false, i % 2 === 1);
    });
  }

  async generalPdf(data: GeneralData, level: string): Promise<Buffer> {
    // Many school columns — landscape keeps them legible.
    const landscape = data.schools.length > 6;
    const schoolName = data.schools.length === 1 ? data.schools[0].name : undefined;

    return this.renderPdf(
      (doc) => {
        doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(`GENERAL roll-up: ${level}`);
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(GREY)
          .text(`Pupils who have memorized each surah, per school · ${data.schools.length} schools`);
        doc.fillColor(INK);

        this.sectionTitle(doc, 'Memorization by surah');

        const codes = data.schools.map((s) => s.code);
        const usable = doc.page.width - 2 * MARGIN;
        const surahW = Math.min(160, usable * 0.32);
        const totalW = 44;
        const schoolW = Math.max(26, Math.floor((usable - surahW - totalW) / Math.max(1, codes.length)));

        this.table(
          doc,
          ['Surah', ...codes, 'TOTAL'],
          [surahW, ...codes.map(() => schoolW), totalW],
          data.rows.map((r) => [
            `${r.surah.number}. ${r.surah.name}`,
            ...data.schools.map((s) => r.perSchool[s.id] ?? 0),
            r.total,
          ]),
        );

        this.sectionTitle(doc, 'Enrolment');
        doc.font('Helvetica').fontSize(8.5).fillColor(GREY);
        doc.text(data.schools.map((s) => `${s.code}: ${s.enrolled}`).join('    '), { width: usable });
      },
      { landscape, schoolName },
    );
  }

  async studentPdf(rep: StudentReport): Promise<Buffer> {
    return this.renderPdf(
      (doc) => {
      const usable = doc.page.width - 2 * MARGIN;
      const s = rep.summary;

      doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(rep.student.fullName);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(GREY)
        .text(
          `${rep.student.school} · ${rep.student.className} (${rep.student.level})` +
            (rep.student.stream ? ` · ${rep.student.stream}` : '') +
            ` · Adm ${rep.student.admissionNo}`,
        );
      doc.fillColor(INK);

      // Progress bar — the headline number of the whole report.
      this.sectionTitle(doc, 'Overall progress');
      const barY = doc.y + 2;
      const barW = usable;
      const pct = Math.max(0, Math.min(100, s.percent));
      doc.roundedRect(MARGIN, barY, barW, 12, 6).fill('#E5E7EB');
      if (pct > 0) doc.roundedRect(MARGIN, barY, (barW * pct) / 100, 12, 6).fill(pct >= 100 ? GOLD : EMERALD);
      doc.y = barY + 18;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(INK)
        .text(`${s.memorized} of ${s.target} surahs memorized  ·  ${s.percent}%`);

      doc.moveDown(0.4);
      const att = Object.entries(s.attendance)
        .map(([k, v]) => `${k[0]}${k.slice(1).toLowerCase()} ${v}`)
        .join('   ') || 'N/A';
      doc.font('Helvetica').fontSize(9).fillColor(INK);
      [
        `Revisions: ${s.revisions}     Assessments: ${s.assessments}     Average score: ${s.avgScore ?? 'N/A'}`,
        `Total mistakes: ${s.mistakes}`,
        `Attendance: ${att}`,
        `Sheikh: ${rep.student.teacher ?? 'N/A'}     Guardian: ${rep.student.guardianName ?? 'N/A'} ${rep.student.guardianPhone ?? ''}`,
      ].forEach((l) => doc.text(l));

      this.sectionTitle(doc, `Memorization (${rep.memorizations.length})`);
      if (rep.memorizations.length) {
        this.table(
          doc,
          ['Surah', 'Juz', 'From', 'To', 'Date'],
          [usable - 260, 50, 60, 60, 90],
          rep.memorizations.map((m) => [m.surah, m.juz, m.ayahFrom ?? 'N/A', m.ayahTo ?? 'N/A', fmtDate(m.date)]),
        );
      } else doc.font('Helvetica').fontSize(9).fillColor(GREY).text('No records.');

      this.sectionTitle(doc, `Revision (${rep.revisions.length})`);
      if (rep.revisions.length) {
        this.table(
          doc,
          ['Surah / Juz', 'Score', 'Date'],
          [usable - 190, 80, 110],
          rep.revisions.map((r) => [r.surah, r.score ?? 'N/A', fmtDate(r.date)]),
        );
      } else doc.font('Helvetica').fontSize(9).fillColor(GREY).text('No records.');

      this.sectionTitle(doc, `Assessments (${rep.assessments.length})`);
      if (rep.assessments.length) {
        this.table(
          doc,
          ['Grade', 'Score', 'Date'],
          [usable - 190, 80, 110],
          rep.assessments.map((a) => [(a.grade ?? 'N/A').replace('_', ' '), a.score ?? 'N/A', fmtDate(a.date)]),
        );
      } else doc.font('Helvetica').fontSize(9).fillColor(GREY).text('No records.');

      // Signature block: these reports get printed and signed by the Sheikh.
      if (doc.y + 90 > doc.page.height - FOOTER_H) doc.addPage();
      doc.moveDown(2);
      const y = doc.y;
      const colW = (usable - 40) / 2;
      doc.strokeColor('#9CA3AF').lineWidth(0.5);
      doc.moveTo(MARGIN, y + 26).lineTo(MARGIN + colW, y + 26).stroke();
      doc.moveTo(MARGIN + colW + 40, y + 26).lineTo(MARGIN + 2 * colW + 40, y + 26).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(GREY);
      doc.text("Sheikh's signature", MARGIN, y + 30, { width: colW });
      doc.text('Manager / EMT', MARGIN + colW + 40, y + 30, { width: colW });
      },
      { schoolName: rep.student.school },
    );
  }
}
