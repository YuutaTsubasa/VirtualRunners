// 虛擬跑跑樂的曲子（全部原創，PC-98 FM 音色）。格式見 music.js 開頭的說明。
// 旋律裡的 | 是小節線，只是方便閱讀；tests/music.test.js 會檢查每小節剛好 4 拍。
// 每小節開頭都寫明八度（o5、o6），比較不會因為 < > 算錯而走音。
//
// 場景：title 標題、menu 選單／大廳、stage-<大關> 每一大關一首（無盡模式跑到哪一大關就換哪一首）、
// tension 魔王關、win 過關、lose 倒下。

// 鼓的節奏型（一小節 16 格）
const POP = { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' };
const DRIVE = { k: 'x...x...x...x...', s: '....x.......x.x.', h: 'xxxxxxxxxxxxxxxx' };
const LIGHT = { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' };
const GALLOP = { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' };
const ROCK = { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' };
const MARCH = { k: 'x...x...x...x...', s: '..x...x...x.xxx.', h: 'x.x.x.x.x.x.x.x.' };

// 一般的伴奏組合：依和弦的貝斯＋電鋼琴＋琶音
function band(prog, { bass = 'r.r5o.5.', chord = 'epiano', rhythm = '..x..x.x', arp = '0121', arpVel = 0.38 } = {}) {
  return [
    { kind: 'bass', patch: 'bass', prog, pattern: bass },
    { kind: 'chords', patch: chord, prog, rhythm, pan: -0.3, vel: 0.6 },
    { kind: 'arp', prog, pattern: arp, oct: 1, pan: -0.4, vel: arpVel },
  ];
}

const TITLE = 'G D Em C G D C D Em C G D C D G G';
const MENU = 'Fmaj7 Am7 Bbmaj7 C7 Fmaj7 Dm7 Gm7 C7';
const CITY = 'C G Am F C G F G Am F C G F G C C';
const FOREST = 'G C G D Em C D D G C G D Em C D G';
const SEA = 'Dm7 G7 Cmaj7 Am7 Dm7 G7 Cmaj7 E7 Fmaj7 Em7 Dm7 Am7 Fmaj7 G7 Cmaj7 Cmaj7';
const ICE = 'Em C D Bm Em C B7 B7 C D Bm Em C D B7 Em';
const MINE = 'Dm Bb C Dm Dm Bb C A Gm Bb C Dm Gm A Dm Dm';
const CASTLE = 'Em Am B7 Em Em Am D G C Am B7 Em C Am B7 Em';
const BOSS = 'Am Am F G Am Am F E';

export const SONGS = {
  // 標題：晴空跑道，G 大調、明亮輕快
  title: {
    bpm: 152,
    loop: true,
    gain: 0.8,
    tracks: [
      {
        kind: 'fm',
        patch: 'lead',
        pan: 0.12,
        mml: `o5 g4 b8 o6 d8 g4 f+8 e8 | o6 f+4 e8 d8 a4 r4 | o6 g4 f+8 e8 o5 b4 o6 e4 | o6 e4 d8 c8 d2 |
              o5 g4 b8 o6 d8 g4 a8 b8 | o6 a4 g8 f+8 d2 | o6 e8 f+8 g8 e8 c4 e4 | o6 d2 r4 o5 a4 |
              o5 b4 o6 e8 g8 b4 a8 g8 | o6 g4 e8 c8 e4 g4 | o6 d4 g8 b8 o7 d4 c8 o6 b8 | o6 a4 f+8 d8 a2 |
              o6 g4 e8 g8 o7 c4 o6 b8 a8 | o6 a4 f+8 a8 o7 d4 c8 o6 a8 | o6 b4 a8 g8 d4 b8 a8 | o6 g2 r2`,
      },
      ...band(TITLE),
      { kind: 'drums', ...POP },
    ],
  },

  // 選單、大廳：晴天午後的 F 大調，放鬆
  menu: {
    bpm: 112,
    loop: true,
    gain: 0.9,
    tracks: [
      {
        kind: 'fm',
        patch: 'flute',
        pan: 0.1,
        mml: `o5 a4 o6 c8 o5 a8 g4 f4 | o5 e4 g8 a8 o6 c2 | o5 d4 f8 a8 o6 d4 c8 o5 b-8 | o5 g2 e4 r4 |
              o5 a4 o6 c8 f8 e4 c4 | o6 d4 c8 o5 a8 f2 | o5 g4 b-8 o6 d8 c4 o5 b-8 a8 | o5 g2 r2`,
      },
      { kind: 'bass', patch: 'bass', prog: MENU, pattern: 'r..5r.5.' },
      { kind: 'chords', patch: 'epiano', prog: MENU, rhythm: '..x..x..', pan: -0.3, vel: 0.6 },
      { kind: 'chords', patch: 'strings', prog: MENU, rhythm: 'W.......', vel: 0.4 },
      { kind: 'drums', ...LIGHT },
    ],
  },

  // ───── 六大關 ─────
  // 白色都市：晴天的高架步道，C 大調流行搖滾
  'stage-city': {
    bpm: 160,
    loop: true,
    gain: 0.75,
    tracks: [
      {
        kind: 'fm',
        patch: 'brass',
        pan: 0.1,
        mml: `o5 e4 g8 o6 c8 e4 d8 c8 | o5 b4 o6 d8 g8 d2 | o6 c4 e8 a8 g4 e8 c8 | o6 c4 o5 a8 f8 a2 |
              o5 e4 g8 o6 c8 e4 g4 | o6 f4 e8 d8 o5 b4 g4 | o5 a8 b8 o6 c8 d8 e4 f4 | o6 d2 r4 o5 g4 |
              o6 c4 o5 a8 o6 c8 e4 a4 | o6 a4 g8 f8 c2 | o6 e4 g8 o7 c8 o6 g4 e4 | o6 d4 g8 f8 d2 |
              o6 c4 f8 a8 o7 c4 o6 a8 f8 | o6 g4 f8 e8 d4 o5 b4 | o6 c4 e8 g8 o7 c4 o6 b8 a8 | o6 g2 r2`,
      },
      ...band(CITY, { bass: 'r.r.r.ro', chord: 'guitar', rhythm: 'x.x.x.x.' }),
      { kind: 'drums', ...ROCK },
    ],
  },

  // 草原森林：風吹過草原，G 大調的笛子，跑起來像騎馬
  'stage-forest': {
    bpm: 148,
    loop: true,
    gain: 0.8,
    tracks: [
      {
        kind: 'fm',
        patch: 'flute',
        pan: 0.1,
        mml: `o5 d4 g8 a8 b4 a8 g8 | o5 e4 g8 o6 c8 e2 | o6 d4 o5 b8 g8 b4 d4 | o5 a2 f+4 a4 |
              o5 g4 b8 o6 e8 g4 f+8 e8 | o6 e4 c8 o5 a8 g4 e4 | o5 f+4 a8 o6 d8 c4 o5 a4 | o5 a2 r2 |
              o6 d4 e8 f+8 g4 d4 | o6 e4 g8 e8 c2 | o6 d4 o5 b8 o6 d8 g4 f+8 e8 | o6 d4 c8 o5 a8 f+2 |
              o5 g4 b8 o6 e8 g4 b4 | o6 a4 g8 e8 c4 e4 | o6 d4 c8 o5 a8 f+4 a4 | o5 g2 r2`,
      },
      ...band(FOREST, { bass: 'r.5.r.5.', arp: '0212' }),
      { kind: 'drums', ...GALLOP },
    ],
  },

  // 水下世界：慢慢飄的爵士和弦，電鋼琴＋鐘琴琶音
  'stage-sea': {
    bpm: 124,
    loop: true,
    gain: 0.85,
    tracks: [
      {
        kind: 'fm',
        patch: 'epiano',
        pan: 0.12,
        mml: `o5 a4 f8 a8 o6 c4 o5 a4 | o5 b4 g8 b8 o6 d2 | o6 e4 d8 c8 o5 b4 g4 | o5 a2 e4 g4 |
              o5 f4 a8 o6 c8 f4 e8 d8 | o6 d4 o5 b8 g8 f4 g4 | o5 e4 g8 b8 o6 e4 d4 | o5 g+2 b4 r4 |
              o6 c4 o5 a8 o6 c8 e4 f4 | o6 g4 e8 d8 o5 b2 | o6 d4 f8 a8 o7 c4 o6 a4 | o6 g4 e8 c8 o5 a2 |
              o5 a4 o6 c8 f8 a4 g8 f8 | o6 d4 g8 f8 d4 o5 b4 | o6 c2 e4 g4 | o6 e2 r2`,
      },
      { kind: 'bass', patch: 'bass', prog: SEA, pattern: 'r..5..r.' },
      { kind: 'chords', patch: 'strings', prog: SEA, rhythm: 'W.......', vel: 0.45 },
      { kind: 'arp', patch: 'bell', prog: SEA, pattern: '0123', oct: 1, pan: -0.4, vel: 0.3 },
      { kind: 'drums', ...LIGHT },
    ],
  },

  // 冰山：清脆的方波旋律＋鐘琴，E 小調
  'stage-ice': {
    bpm: 150,
    loop: true,
    gain: 0.8,
    tracks: [
      {
        kind: 'ssg',
        pan: 0.12,
        vel: 0.75,
        mml: `o5 b4 o6 e8 f+8 g4 f+8 e8 | o6 e4 g8 o7 c8 o6 g2 | o6 f+4 a8 f+8 d4 f+4 | o6 d4 o5 b8 a8 b2 |
              o5 g4 b8 o6 e8 g4 b4 | o6 a4 g8 e8 c4 e4 | o6 d+4 f+8 a8 b4 a4 | o6 f+2 d+4 r4 |
              o6 e4 g8 e8 c4 g4 | o6 f+4 a8 f+8 d4 a4 | o6 b4 a8 f+8 d4 f+4 | o6 g4 f+8 e8 o5 b2 |
              o6 c4 e8 g8 o7 c4 o6 b8 a8 | o6 a4 f+8 d8 a4 o7 d4 | o6 b4 a8 f+8 d+4 f+4 | o6 e2 r2`,
      },
      { kind: 'fm', patch: 'bell', pan: -0.2, vel: 0.35, mml: `o6 r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 | o6 e4 r4 g4 r4 | o6 f+4 r4 a4 r4 | o6 d4 r4 f+4 r4 | o6 e4 r4 b4 r4 | o6 e4 r4 g4 r4 | o6 f+4 r4 a4 r4 | o6 d+4 r4 f+4 r4 | o6 e2 r2` },
      ...band(ICE, { chord: 'strings', rhythm: 'W.......', arp: '0121', arpVel: 0.32 }),
      { kind: 'drums', ...POP },
    ],
  },

  // 火炎礦坑：D 小調的硬派搖滾，銅管＋吉他
  'stage-mine': {
    bpm: 172,
    loop: true,
    gain: 0.75,
    tracks: [
      {
        kind: 'fm',
        patch: 'brass',
        pan: 0.1,
        mml: `o5 d4 f8 a8 o6 d4 c8 o5 a8 | o5 b-4 o6 d8 f8 d2 | o6 e4 c8 o5 g8 o6 c4 e4 | o6 d2 o5 a4 f4 |
              o5 d4 f8 a8 o6 d4 f4 | o6 f4 d8 o5 b-8 o6 d4 f4 | o6 e4 g8 e8 c4 e4 | o6 c+2 e4 a4 |
              o6 b-4 a8 g8 d4 g4 | o6 f4 d8 f8 b-4 a4 | o6 g4 e8 c8 g4 e4 | o6 f4 e8 d8 a2 |
              o6 g4 b-8 o7 d8 o6 b-4 g4 | o6 a4 g8 f8 e4 c+4 | o6 d4 f8 a8 o7 d4 c8 o6 a8 | o6 d2 r2`,
      },
      { kind: 'bass', patch: 'bass', prog: MINE, pattern: 'rrrrrrrr' },
      { kind: 'chords', patch: 'guitar', prog: MINE, rhythm: 'x.x.x.xx', pan: -0.3, vel: 0.45 },
      { kind: 'drums', ...DRIVE },
    ],
  },

  // 邪惡城堡：管風琴的 E 小調進行曲
  'stage-castle': {
    bpm: 156,
    loop: true,
    gain: 0.75,
    tracks: [
      {
        kind: 'fm',
        patch: 'organ',
        pan: 0.1,
        mml: `o5 e4 g8 b8 o6 e4 d+8 e8 | o6 c4 o5 a8 o6 c8 e4 a4 | o6 f+4 d+8 f+8 b4 a4 | o6 g2 e4 r4 |
              o5 b4 o6 e8 g8 b4 a8 g8 | o6 a4 g8 f+8 e2 | o6 f+4 a8 f+8 d4 f+4 | o6 g2 d4 o5 b4 |
              o6 c4 e8 g8 o7 c4 o6 g4 | o6 a4 o7 c8 o6 a8 e4 c4 | o6 b4 a8 g8 f+4 d+4 | o6 e2 o5 b4 r4 |
              o6 e4 g8 o7 c8 o6 b4 a4 | o6 a4 g8 e8 c4 e4 | o6 d+4 f+8 a8 b4 d+4 | o6 e2 r2`,
      },
      { kind: 'bass', patch: 'bass', prog: CASTLE, pattern: 'r.r.r.5.' },
      { kind: 'chords', patch: 'strings', prog: CASTLE, rhythm: 'W.......', pan: -0.3, vel: 0.5 },
      { kind: 'arp', prog: CASTLE, pattern: '0121', oct: 1, pan: -0.4, vel: 0.32 },
      { kind: 'drums', ...MARCH },
    ],
  },

  // 魔王關：A 小調、八分音符一路衝
  tension: {
    bpm: 176,
    loop: true,
    gain: 0.75,
    tracks: [
      {
        kind: 'fm',
        patch: 'brass',
        pan: 0.1,
        mml: `o5 a8 o6 c8 e8 a8 g8 e8 c8 e8 | o6 a8 g8 e8 c8 o5 a4 o6 e4 | o6 f8 a8 o7 c8 o6 a8 f4 c4 | o6 d8 g8 b8 g8 d4 o5 b4 |
              o5 a8 o6 c8 e8 a8 b8 a8 g8 e8 | o6 c4 e4 a4 e4 | o6 f8 e8 f8 a8 o7 c4 o6 a4 | o6 g+2 b4 e4`,
      },
      { kind: 'bass', patch: 'bass', prog: BOSS, pattern: 'rrrrrrrr' },
      { kind: 'arp', prog: BOSS, pattern: '0121', oct: 1, pan: -0.35, vel: 0.45 },
      { kind: 'drums', ...DRIVE },
    ],
  },

  // ───── 短曲 ─────
  // 過關
  win: {
    bpm: 150,
    loop: false,
    tracks: [
      { kind: 'fm', patch: 'brass', pan: 0.15, mml: 'o5 g8 b8 o6 d8 g8 r8 d8 g4 | o6 a8 b8 a8 g8 f+4 d4 | o6 e8 f+8 g8 e8 c4 e4 | o6 d4 g4 g2' },
      { kind: 'ssg', vel: 0.55, pan: -0.25, mml: 'o6 d8 g8 b8 o7 d8 r8 o6 b8 o7 d4 | o6 f+8 g8 f+8 d8 a4 f+4 | o6 g8 a8 b8 g8 e4 g4 | o6 b4 o7 d4 d2' },
      { kind: 'fm', patch: 'bass', mml: 'o3 g4 g4 g4 g4 | o3 d4 d4 d4 d4 | o3 c4 c4 c4 c4 | o3 d4 g4 g2' },
      { kind: 'drums', k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', hits: [['c', 12], ['k', 12]] },
    ],
  },
  // 倒下
  lose: {
    bpm: 120,
    loop: false,
    tracks: [
      { kind: 'fm', patch: 'lead', mml: 'o5 b4 a4 g4 f+4 | o5 e4 g4 f+2 | o5 e4 d4 c4 o4 b4 | o5 e2 r2' },
      { kind: 'fm', patch: 'bass', mml: 'o3 e2 e2 | o3 c2 d2 | o3 a2 b2 | o3 e2 r2' },
      { kind: 'drums', hits: [['k', 0], ['s', 1], ['k', 2], ['s', 3], ['k', 12]] },
    ],
  },
};
