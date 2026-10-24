// 虛擬跑跑樂的曲子（全部原創，PC-98 FM 音色）。格式見 music.js 開頭的說明。
// 旋律裡的 | 是小節線，只是方便閱讀；tests/music.test.js 會檢查每小節剛好 4 拍。
// 每小節開頭都寫明八度（o5、o6），比較不會因為 < > 算錯而走音。

// 鼓的節奏型（一小節 16 格）
const POP = { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' };
const DRIVE = { k: 'x...x...x...x...', s: '....x.......x.x.', h: 'xxxxxxxxxxxxxxxx' };
const LIGHT = { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' };
const SAMBA = { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' };

export const SONGS = {
  // 標題：晴天的海灘，輕快的 D 大調
  title: {
    bpm: 140,
    loop: true,
    gain: 0.8,
    tracks: [
      {
        kind: 'fm',
        patch: 'lead',
        pan: 0.12,
        mml: `o5 a4 f+8 a8 o6 d4 o5 a4 | o5 g8 f+8 e8 f+8 e4 c+4 | o5 d4 f+8 b8 o6 d4 c+8 o5 b8 | o5 b4 a8 g8 a2 |
              o5 a4 f+8 a8 o6 d4 e8 f+8 | o6 e4 c+8 e8 o5 a4 g8 f+8 | o5 g4 b8 o6 d8 o5 g4 f+8 e8 | o5 e4 f+8 g8 a2 |
              o5 b4 a8 b8 o6 d4 c+8 d8 | o6 e4 d8 c+8 o5 a2 | o5 a4 f+8 a8 o6 c+4 e8 c+8 | o6 d4 c+8 o5 b8 f+2 |
              o5 g4 b8 o6 d8 g4 f+8 e8 | o6 e4 d8 c+8 e4 a8 g8 | o6 f+4 e8 d8 o5 a4 b8 o6 c+8 | o6 d2 r2`,
      },
      { kind: 'bass', patch: 'bass', prog: 'D A Bm G D A G A G A F#m Bm G A D D', pattern: 'r.r5o.5.' },
      { kind: 'chords', patch: 'epiano', prog: 'D A Bm G D A G A G A F#m Bm G A D D', rhythm: '..x..x.x', pan: -0.3, vel: 0.65 },
      { kind: 'arp', prog: 'D A Bm G D A G A G A F#m Bm G A D D', pattern: '0121', oct: 1, pan: -0.4, vel: 0.4 },
      { kind: 'drums', ...POP },
    ],
  },

  // 選單、大廳：海邊的午後，放鬆的 F 大調
  menu: {
    bpm: 112,
    loop: true,
    gain: 0.9,
    tracks: [
      {
        kind: 'fm',
        patch: 'flute',
        pan: 0.1,
        mml: `o5 a4 g8 a8 o6 c4 o5 a4 | o5 g4 e8 g8 b2 | o5 f4 a8 o6 c8 d4 c8 o5 a8 | o5 g2 e4 g4 |
              o5 f4 a8 b-8 o6 d4 c8 o5 b-8 | o5 a4 e8 g8 a2 | o5 g4 b-8 a8 g4 f8 e8 | o5 e2 g4 r4`,
      },
      { kind: 'bass', patch: 'bass', prog: 'Fmaj7 Em7 Dm7 C Bbmaj7 Am7 Gm7 C7', pattern: 'r..5r.5.' },
      { kind: 'chords', patch: 'epiano', prog: 'Fmaj7 Em7 Dm7 C Bbmaj7 Am7 Gm7 C7', rhythm: '..x..x..', pan: -0.3, vel: 0.6 },
      { kind: 'chords', patch: 'strings', prog: 'Fmaj7 Em7 Dm7 C Bbmaj7 Am7 Gm7 C7', rhythm: 'W.......', vel: 0.4 },
      { kind: 'drums', ...LIGHT },
    ],
  },

  // 比賽：全力衝刺的 A 小調搖滾
  match: {
    bpm: 156,
    loop: true,
    gain: 0.75,
    tracks: [
      {
        kind: 'fm',
        patch: 'brass',
        pan: 0.1,
        mml: `o5 a4 a8 b8 o6 c4 o5 b8 a8 | o5 f4 a8 o6 c8 f4 e8 d8 | o6 d4 o5 b8 g8 d4 g8 b8 | o5 b4 a8 g8 e2 |
              o5 a4 o6 c8 e8 a4 g8 e8 | o6 f4 e8 d8 c4 o5 a8 o6 c8 | o6 d4 c8 o5 b8 g4 b8 o6 d8 | o5 g+2 b4 o6 e4 |
              o6 f4 e8 f8 a4 f8 c8 | o6 d4 c8 d8 g4 d8 o5 b8 | o5 b4 o6 c8 d8 e4 g8 e8 | o6 c4 o5 b8 a8 e4 a4 |
              o5 f4 a8 o6 c8 f4 e8 f8 | o6 g4 f8 e8 d4 o5 b8 g8 | o5 a4 o6 c8 e8 a4 b8 o7 c8 | o6 b2 g+4 e4`,
      },
      {
        kind: 'ssg',
        pan: 0.35,
        vel: 0.5,
        mml: `o6 r2 e8 r8 a8 r8 | o6 r2 c8 r8 f8 r8 | o6 r2 d8 r8 g8 r8 | o6 r2 e8 r8 g+8 r8 |
              o6 r2 e8 r8 a8 r8 | o6 r2 c8 r8 f8 r8 | o6 r2 d8 r8 g8 r8 | o6 r2 g+8 r8 b8 r8 |
              o6 r2 c8 r8 f8 r8 | o6 r2 d8 r8 g8 r8 | o6 r2 e8 r8 g8 r8 | o6 r2 e8 r8 a8 r8 |
              o6 r2 c8 r8 f8 r8 | o6 r2 d8 r8 g8 r8 | o6 r2 e8 r8 a8 r8 | o6 r2 g+8 r8 b8 r8`,
      },
      { kind: 'bass', patch: 'bass', prog: 'Am F G Em Am F G E F G Em Am F G Am E', pattern: 'rrrrrrrr' },
      { kind: 'chords', patch: 'guitar', prog: 'Am F G Em Am F G E F G Em Am F G Am E', rhythm: 'x.x.x.x.', pan: -0.3, vel: 0.42 },
      { kind: 'drums', ...DRIVE },
    ],
  },

  // 賽末點：E 小調、更快，緊張感
  tension: {
    bpm: 168,
    loop: true,
    gain: 0.75,
    tracks: [
      {
        kind: 'fm',
        patch: 'brass',
        pan: 0.1,
        mml: `o5 e8 e8 g4 b4 a8 g8 | o5 f+4 a4 o6 c4 o5 b4 | o5 e8 e8 g4 b4 o6 d8 c8 | o5 b2 d+2`,
      },
      { kind: 'bass', patch: 'bass', prog: 'Em C D B7', pattern: 'rrrrrrrr' },
      { kind: 'arp', prog: 'Em C D B7', pattern: '0121', oct: 1, pan: -0.35, vel: 0.5 },
      { kind: 'drums', ...SAMBA },
    ],
  },

  // ───── 短曲 ─────
  // 贏得比賽
  win: {
    bpm: 150,
    loop: false,
    tracks: [
      { kind: 'fm', patch: 'brass', pan: 0.15, mml: 'o5 l8 d f+ a >d4 c+< a >d2' },
      { kind: 'fm', patch: 'lead', pan: -0.2, vel: 0.7, mml: 'o4 l8 a >d f+ a4 a e f+2' },
      { kind: 'fm', patch: 'bass', mml: 'o2 l8 d d d d4 e4 d2' },
      { kind: 'ssg', vel: 0.6, mml: 'o6 l16 r2 r8 d f+ a >d4< r8 a8 >d2' },
      { kind: 'drums', k: 'x...x...x...', s: '....x..x..x.', h: 'x.x.x.x.x.x.', hits: [['c', 3.5], ['k', 3.5]] },
    ],
  },
  // 輸掉比賽
  lose: {
    bpm: 132,
    loop: false,
    tracks: [
      { kind: 'fm', patch: 'lead', mml: 'o5 l8 e d+ d c+ c4. r <b2' },
      { kind: 'fm', patch: 'bass', mml: 'o3 l8 c c c c <b4. r a+2' },
      { kind: 'drums', hits: [['k', 0], ['s', 1], ['k', 2], ['s', 3]] },
    ],
  },
};
