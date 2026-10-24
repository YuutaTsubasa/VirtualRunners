// 六大關 × 8 小關的名稱、配色與敵人的名字（第 8 小關是魔王關）。跑道怎麼生在 crates/runner-core/src/course.rs。
// 敵人、魔王、背景的圖沿用虛擬闖天下（public/enemies、bosses、stages）。

export const WORLDS = [
  {
    id: 'city',
    name: '白色都市',
    subs: ['白色大道', '商店街', '天台夜路', '高架橋', '地下道', '港口倉庫', '鐘樓頂', '中央廣場'],
    sky: ['#9fd3ff', '#e9f5ff'],
    ground: ['#d9dde6', '#b9c0cf'],
    // 敵人配色：衣服、褲子、頭（膚色或面具）
    enemy: { cloth: '#4a5a7c', pants: '#2a3248', head: '#f2cfb2', accent: '#ff6b81' },
    names: { thug: '街頭混混', knife: '飛刀仔', brute: '大隻佬', thrower: '丟瓶客' },
    boss: { name: '白銀幫老大', color: '#c9d3e6', accent: '#3a4766' },
  },
  {
    id: 'forest',
    name: '草原森林',
    subs: ['風之草原', '花田小徑', '迷霧森林', '吊橋溪谷', '蘑菇林', '古樹隧道', '螢火沼澤', '巨木深處'],
    sky: ['#8fe0ff', '#e5fbd8'],
    ground: ['#7cc35a', '#4f9a3c'],
    enemy: { cloth: '#7a5a3a', pants: '#4a3a28', head: '#a9d67a', accent: '#e2c044' },
    names: { thug: '山賊', knife: '林間刺客', brute: '野豬人', thrower: '投石哥布林' },
    boss: { name: '森林巨熊', color: '#7a4e2c', accent: '#f2d38a' },
  },
  {
    id: 'sea',
    name: '水下世界',
    subs: ['珊瑚礁', '海藻林', '沉船', '海溝邊緣', '水母群', '人魚遺跡', '深海洞窟', '深海神殿'],
    sky: ['#1d6fb5', '#5ec3e8'],
    ground: ['#e7d7a3', '#c4ad72'],
    enemy: { cloth: '#2fa39a', pants: '#20605e', head: '#8fe0c8', accent: '#ffb35c' },
    names: { thug: '魚人兵', knife: '劍魚戰士', brute: '大螃蟹', thrower: '吐墨章魚' },
    boss: { name: '鯊魚將軍', color: '#5f7d99', accent: '#e8f1ff' },
  },
  {
    id: 'ice',
    name: '冰山',
    subs: ['雪原', '冰湖', '冰窟', '雪崩坡', '極光山道', '冰晶迷宮', '暴風雪', '冰之王座'],
    sky: ['#bfe6ff', '#f7fcff'],
    ground: ['#e9f6ff', '#bcdaf0'],
    enemy: { cloth: '#5b86c4', pants: '#2f4f7f', head: '#e9f2ff', accent: '#ffffff' },
    names: { thug: '雪人兵', knife: '冰刃忍者', brute: '雪怪', thrower: '雪球手' },
    boss: { name: '冰雪女王', color: '#9fd4ff', accent: '#ffffff' },
  },
  {
    id: 'mine',
    name: '火炎礦坑',
    subs: ['礦坑入口', '軌道岔路', '熔岩河', '炸藥庫', '地熱管道', '火山斜坡', '岩漿瀑布', '火山心臟'],
    sky: ['#3a1410', '#a3361c'],
    ground: ['#5a3a2a', '#3a2418'],
    enemy: { cloth: '#c4552c', pants: '#4a2a1a', head: '#f2b08a', accent: '#ffd23f' },
    names: { thug: '礦工', knife: '火蜥蜴', brute: '岩石巨漢', thrower: '炸藥工' },
    boss: { name: '熔岩巨人', color: '#7a2f1c', accent: '#ff9a2e' },
  },
  {
    id: 'castle',
    name: '邪惡城堡',
    subs: ['城門', '護城河', '迴廊', '鐘塔', '地牢', '王座前廳', '空中走廊', '魔王之間'],
    sky: ['#1a0f2e', '#4a2a6a'],
    ground: ['#4a4458', '#2e2a3a'],
    enemy: { cloth: '#3a2a52', pants: '#1e1630', head: '#c9b8e6', accent: '#b03aff' },
    names: { thug: '骷髏兵', knife: '暗殺者', brute: '石像鬼', thrower: '黑魔法師' },
    boss: { name: '魔王', color: '#2a1840', accent: '#ff3a6a' },
  },
];

export const stageLabel = (world, sub) => `${world + 1}-${sub + 1}`;

// 每一大關有三張背景（沿用虛擬闖天下的 <大關>-1～3），8 小關輪著用：1～3 關第一張、4～6 關第二張、7～8 關第三張（魔王關）
export const backdropOf = (stage) => (stage < 3 ? 0 : stage < 6 ? 1 : 2);

// 每一大關多了什麼（關卡地圖上的說明）
export const WORLD_TIPS = [
  '跳過尖刺、踩扁小混混，熟悉一下跑法！',
  '橫桿要按住「滑」鑽過去；踩到彈簧會飛很高。',
  '水裡跳得慢、飄得久；坑上的敵人可以用空中追擊一路打過去。',
  '冰柱跑近就會掉下來；刀手會衝過來。',
  '火柱一陣一陣噴，看準時機再過。',
  '所有機關都來了，最後的城堡！',
];
export const ITEM_NAMES = { apple: '蘋果', meat: '烤肉', feast: '大餐', gem: '寶石' };
