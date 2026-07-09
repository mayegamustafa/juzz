# 05 — Wireframes

ASCII wireframes for the V1 screens. Theme: emerald-green primary, gold secondary, white
surface; mobile-first responsive; light/dark.

## Legend
`[ ]` button · `▢` checkbox cell (empty) · `■` ticked (memorized) · `◧` partial · `▾` dropdown

---

## W1 — Login (mobile & desktop)
```
┌──────────────────────────────┐
│        ☪  QPMS               │
│  Quran Progress & Memorization│
│                              │
│  Email / Phone  [__________] │
│  Password       [__________] │
│                  [ Sign in ] │
│  Forgot password?            │
└──────────────────────────────┘
```

## W2 — Dashboard (role-aware)
```
┌── QPMS ───────────────────  ◑ 🔔 👤 ─┐
│ ☰  Dashboard                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│ │Students │ │ Memoriz.│ │ Avg %   │  │
│ │  1,240  │ │  8,932  │ │  41%    │  │
│ └─────────┘ └─────────┘ └─────────┘  │
│ Progress by school        [bar chart] │
│ ▇▇▇▇ CPS  ▇▇▇ Mengo  ▇▇ Kisaasi ...   │
│ Recent activity                       │
│ • NYOMBI ticked An-Nas for R. Rehan   │
└───────────────────────────────────────┘
```
Sidebar (≥md) / drawer (mobile): Dashboard · Schools · Classes · Students · Teachers ·
**Tracking** · Targets · Reports · Settings (items shown per role).

## W3 — Students list
```
┌ Students ─────────────  [+ Add] [Import] ┐
│ School ▾  Class ▾  Stream ▾  Sheikh ▾  🔍 │
│ ┌──────────────────────────────────────┐ │
│ │ Name           Class  Sheikh  Prog.   │ │
│ │ KYAGULANYI R.  P.1    NYOMBI  ▇▇░ 19% │ │
│ │ JUMBA TAHIR    P.1    NYOMBI  ▇▇░ 19% │ │
│ │ IMAAMA HAMID   P.1    NAWIIRA ▇▇▇ 25% │ │
│ └──────────────────────────────────────┘ │
│                      ‹ 1 2 3 … ›          │
└───────────────────────────────────────────┘
```

## W4 — Student profile
```
┌ ‹ Back   KYAGULANYI REHAN          [Edit] ┐
│ P.1 · City Parents · Sheikh: NYOMBI       │
│ Adm #: CPS-001  Guardian: … 0772…         │
│ ┌ Progress ──────────────────────────────┐│
│ │ 2-Juzu target  ▇▇▇░░░░░░  9/48 (19%)   ││
│ └────────────────────────────────────────┘│
│ Tabs: [Memorization] Revision Assessment  │
│        Attendance  Remarks                │
│ Memorized surahs: An-Nas ■ Al-Falaq ■ ... │
│ Remarks:                                  │
│  • "Needs revision on last 3 surahs" —NYOMBI│
│  [ + Add remark ]                         │
└────────────────────────────────────────────┘
```

## W5 — Tracking grid  (THE core screen)
Students as rows, surahs as columns; tap a cell to toggle memorized. Sticky first column &
header; horizontally scrollable on mobile.
```
┌ Tracking   Class: P.1 ▾  Juz: ʿAmma+Tabāraka ▾   [Save] ┐
│             │114│113│112│111│110│109│108│107│106│ … │67 │
│ Surah →     │Nas│Flq│Ikh│Msd│Nsr│Kfn│Kth│Mun│Qrs│   │Mlk│
│─────────────┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┼───┤
│ Rehan       │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │   │ ▢ │
│ Tahir       │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │   │ ▢ │
│ Shan        │ ■ │ ■ │ ■ │ ■ │ ▢ │ ▢ │ ▢ │ ▢ │ ▢ │   │ ▢ │
│ Adnan       │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ■ │ ▢ │ ▢ │   │ ▢ │
│─────────────┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┤
│ Tap = toggle ■/▢ · long-press = set partial ◧ · auto %  │
└──────────────────────────────────────────────────────────┘
```
- Each toggle calls `PUT /quran/memorization` (optimistic UI; queued offline in mobile).
- Right edge per row can show running % toward the 2-Juzu target.

## W6 — Reports center
```
┌ Reports ───────────────────────────────────┐
│ Type ▾ (Student/Class/School/Org/GENERAL)   │
│ Scope ▾   Term ▾                            │
│ [ Generate ]   [ Export PDF ] [ Export XLSX]│
│ ── GENERAL roll-up (P.1) ──                 │
│ Surah   CPS MEN KIS OK WIN … TOTAL          │
│ 114      48  52  48 18  24 …  310           │
│ 113      48  52  48 18  24 …  297           │
│ ...                                         │
└─────────────────────────────────────────────┘
```

## W7 — Settings
Profile · password · theme (light/dark) · (SA) terms, targets, org, backups.

---

## Mobile (Flutter, later) — same flows, native
- Bottom nav: Home · Students · **Tracking** · Reports · Profile.
- Tracking grid uses a sticky-header data table; offline banner when disconnected;
  a sync indicator showing pending changes.
