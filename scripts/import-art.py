#!/usr/bin/env python3
"""把 ChatGPT 交的 90 年代美術包（art-inbox/<主題>/ 或 .zip）接進遊戲。

用法：python scripts/import-art.py art-inbox/anime90-runner-frames-01
（從虛擬闖天下的 import-quest-art.py 複製過來，多了跑酷專用的格子）

交件的結構見 art-inbox/README.md：
  characters/<id>/sprites/<動作>.png        512×512，腳底 (256, 496)
  enemies/<大關>/<種類>/<動作>.png           512×512，腳底 (256, 496)
  bosses/<大關>/<動作>.png                   768×768，腳底 (384, 744)
  environment/<大關>-<小關>/{far,mid,ground}.png   1920×1080
  props/<大關>-crate.png、props/items/*.png、props/shots/*.png
  props/runner/*.png（跑酷的道具，照交件尺寸存；清單在 sheets.json 的 runner）
  ui/*.png（Logo 縮成 1200 寬、保留透明；標題圖等其他插圖照原尺寸）

產出（都是 WebP）：
  public/sprites/<id>.webp                   8×2 圖集（每格 400），格子順序見 src/lib/game/sheets.json
  public/enemies/<大關>/<種類>.webp          橫排（每格 400）
  public/bosses/<大關>.webp                  橫排（每格 600，跟角色同比例尺）
  public/stages/<大關>-<小關>/{far,mid,ground}.webp
  public/props/...
並更新 src/lib/game/sheets.json（畫面用）與 src/lib/style-assets.json（預先載入用）。

圖的 alpha：生圖工具交的人物大多是 253/255，接的時候把 ≥240 的拉成全不透明，免得角色微微透光。

寬的姿勢（高踢、敵人出手、衝撞）為了塞進格子會整個縮小（站著 400px、踢腿只剩 280～350px）。
交件包的 layout-metrics.json 有每格的實際人物高度：這些格子記一個放大倍數（fix），
畫面會以腳底為中心放大回來，踢腿時人不會突然變小。
"""

import json
import os
import shutil
import sys
import tempfile
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
SHEETS = os.path.join(ROOT, 'src', 'lib', 'game', 'sheets.json')
MANIFEST = os.path.join(ROOT, 'src', 'lib', 'style-assets.json')

CHARACTER_FRAMES = ['idle', 'walk1', 'walk2', 'punch1', 'punch2', 'kick', 'jump', 'jumpkick',
                    'special', 'grab', 'knee', 'throw', 'hurt', 'fall', 'down', 'win',
                    # 跑步與衝刺攻擊（後來加的，requests/2026-10-24-0910-anime90-run-frames.md）
                    'run1', 'run2', 'dash',
                    # 走路補成四格：兩格收腳（requests/2026-10-24-1500-anime90-walk-down-fix.md）
                    'walk3', 'walk4',
                    # 虛擬跑跑樂：跑步補成四格、滑行、空中翻滾、過終點（requests/2026-10-24-1700-anime90-runner-frames.md）
                    'run3', 'run4', 'slide', 'roll', 'goal',
                    # 跑步補成八格：每兩格中間的過渡（requests/2026-10-24-1830-anime90-run-inbetweens.md）
                    'run5', 'run6', 'run7', 'run8']
ENEMY_FRAMES = ['idle', 'walk1', 'walk2', 'windup', 'attack', 'hurt', 'fall', 'down', 'charge', 'walk3', 'walk4']
BOSS_FRAMES = ['idle', 'walk1', 'walk2', 'windup', 'slam', 'hurt', 'fall', 'down', 'charge', 'leap', 'cast', 'vanish']
CELL = 400
# 哪些格子要依實際高度放大回來：目標高度＝這張圖集 idle 的高度 × 比例；最多放大幾倍
FIX_CHARACTER = {'kick': 0.925, 'dash': 0.85}
# charge 常常是壓肩低頭的姿勢，只補到站立高度的 80%
FIX_ENEMY = {'attack': 0.9, 'windup': 0.95, 'charge': 0.8, 'walk1': 0.95, 'walk2': 0.95}
# 魔王的 slam／cast 常常是故意蹲低的姿勢（例如森林巨熊雙掌觸地），不能照 idle 高度放大，只補 charge
FIX_BOSS = {'charge': 0.8, 'walk1': 0.95, 'walk2': 0.95}
# 整張圖集太小（長吻、大鉗子、披風為了塞進格子而縮小）：站立 idle 應該有的大小
# 人形用高度比；大隻的（brute）用面積比，免得很寬的大螃蟹被放到比格子還大
IDLE_HEIGHT = {'character': 400, 'enemy': 380, 'boss': 650}
BRUTE_IDLE = (460, 381)
FIX_MAX = 1.45
BOSS_CELL = 600


def load(path):
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v >= 240 else v)
    im.putalpha(a)
    return im


def save(im, rel, lossless=False):
    out = os.path.join(PUBLIC, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if lossless:
        im.save(out, 'WEBP', lossless=True, method=6)
    else:
        im.save(out, 'WEBP', quality=90, method=6, alpha_quality=95)
    print('  ', rel, im.size)
    return rel.replace(os.sep, '/')


def heights(metrics, prefix):
    """layout-metrics.json 裡每格的實際人物高度：{動作: 高度}"""
    out = {}
    for path, info in (metrics.get('assets') or {}).items():
        if path.startswith(prefix) and path.endswith('.png'):
            h = info.get('actualSilhouetteHeight') or (info.get('visibleBounds') or {}).get('height')
            if h:
                out[path[len(prefix):-4]] = h
    return out


def fixes(names, hs, table):
    out = {}
    idle = hs.get('idle')
    if not idle:
        return out
    for name, ratio in table.items():
        if name in names and hs.get(name):
            k = min(FIX_MAX, max(1.0, idle * ratio / hs[name]))
            if k > 1.02:
                out[name] = round(k, 3)
    return out


def sheet_scale(metrics, prefix, kind):
    info = (metrics.get('assets') or {}).get(prefix + 'idle.png') or {}
    b = info.get('visibleBounds') or {}
    h = info.get('actualSilhouetteHeight') or b.get('height')
    w = b.get('width')
    if not h:
        return 1.0
    if kind == 'brute' and w:
        k = ((BRUTE_IDLE[0] * BRUTE_IDLE[1]) / (h * w)) ** 0.5
    else:
        k = IDLE_HEIGHT['boss' if kind == 'boss' else 'character' if kind == 'character' else 'enemy'] / h
    k = min(FIX_MAX, max(1.0, k))
    return round(k, 3) if k > 1.03 else 1.0


def old_cells(entry):
    """已經接過的圖集拆回一格一格：{動作: 圖}（補交幾格時，其他格沿用原本的）"""
    if not entry:
        return {}
    path = os.path.join(PUBLIC, entry['src'])
    if not os.path.exists(path):
        return {}
    atlas = Image.open(path).convert('RGBA')
    c, cols = entry['cell'], entry['cols']
    return {name: atlas.crop(((i % cols) * c, (i // cols) * c, (i % cols + 1) * c, (i // cols + 1) * c))
            for i, name in enumerate(entry['frames'])}


def strip(frames, folder, cell, cols=None, keep=None):
    """把有的格子排成圖集；回傳（圖, 實際有的格子名, 欄數）。
    keep：原本圖集裡的格子，這次沒交的就沿用（例如只補交跑步 3 格）"""
    keep = keep or {}
    new = {f for f in frames if os.path.exists(os.path.join(folder, f + '.png'))}
    if not new:
        return None, [], 0
    names = [f for f in frames if f in new or f in keep]
    cols = cols or len(names)
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new('RGBA', (cell * cols, cell * rows), (0, 0, 0, 0))
    for i, name in enumerate(names):
        if name in new:
            im = load(os.path.join(folder, name + '.png')).resize((cell, cell), Image.LANCZOS)
        else:
            im = keep[name].resize((cell, cell), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * cell, (i // cols) * cell))
    return sheet, names, cols


def main(src):
    tmp = None
    if src.endswith('.zip'):
        tmp = tempfile.mkdtemp()
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                if n.startswith('/') or '..' in n.split('/'):
                    sys.exit(f'壓縮檔路徑不安全：{n}')
            z.extractall(tmp)
        entries = os.listdir(tmp)
        src = os.path.join(tmp, entries[0]) if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])) else tmp

    metrics_path = os.path.join(src, 'layout-metrics.json')
    metrics = json.load(open(metrics_path, encoding='utf-8')) if os.path.exists(metrics_path) else {}
    sheets = json.load(open(SHEETS, encoding='utf-8')) if os.path.exists(SHEETS) else {}
    for k in ['characters', 'enemies', 'bosses', 'stages', 'props', 'items', 'shots', 'runner']:
        sheets.setdefault(k, {} if k in ('characters', 'enemies', 'bosses') else [])
    written = []

    chars = os.path.join(src, 'characters')
    for cid in sorted(os.listdir(chars)) if os.path.isdir(chars) else []:
        folder = os.path.join(chars, cid, 'sprites')
        before = sheets['characters'].get(cid)
        sheet, names, cols = strip(CHARACTER_FRAMES, folder, CELL, cols=8, keep=old_cells(before))
        if sheet:
            written.append(save(sheet, f'sprites/{cid}.webp'))
            sheets['characters'][cid] = {'src': f'sprites/{cid}.webp', 'frames': names, 'cols': cols, 'cell': CELL}
            # 補交幾格時，原本那些格的放大倍數也要留著；這次重畫的格子舊的倍數就不算了
            # （頭的大小用 scripts/measure-head-scale.py --write 重新量）
            redrawn = {f for f in names if os.path.exists(os.path.join(folder, f + '.png'))}
            old_fix = {f: v for f, v in (before or {}).get('fix', {}).items() if f not in redrawn}
            fix = {**old_fix, **fixes(names, heights(metrics, f'characters/{cid}/sprites/'), FIX_CHARACTER)}
            if fix:
                sheets['characters'][cid]['fix'] = fix
            if (before or {}).get('scale'):
                sheets['characters'][cid]['scale'] = before['scale']
            k = sheet_scale(metrics, f'characters/{cid}/sprites/', 'character')
            if k > 1:
                sheets['characters'][cid]['scale'] = k

    enemies = os.path.join(src, 'enemies')
    for world in sorted(os.listdir(enemies)) if os.path.isdir(enemies) else []:
        for kind in sorted(os.listdir(os.path.join(enemies, world))):
            sheet, names, cols = strip(ENEMY_FRAMES, os.path.join(enemies, world, kind), CELL)
            if sheet:
                rel = f'enemies/{world}/{kind}.webp'
                written.append(save(sheet, rel))
                sheets['enemies'][f'{world}/{kind}'] = {'src': rel, 'frames': names, 'cols': cols, 'cell': CELL}
                fix = fixes(names, heights(metrics, f'enemies/{world}/{kind}/'), FIX_ENEMY)
                if fix:
                    sheets['enemies'][f'{world}/{kind}']['fix'] = fix
                k = sheet_scale(metrics, f'enemies/{world}/{kind}/', kind)
                if k > 1:
                    sheets['enemies'][f'{world}/{kind}']['scale'] = k

    bosses = os.path.join(src, 'bosses')
    for world in sorted(os.listdir(bosses)) if os.path.isdir(bosses) else []:
        sheet, names, cols = strip(BOSS_FRAMES, os.path.join(bosses, world), BOSS_CELL, cols=6)
        if sheet:
            rel = f'bosses/{world}.webp'
            written.append(save(sheet, rel))
            sheets['bosses'][world] = {'src': rel, 'frames': names, 'cols': cols, 'cell': BOSS_CELL}
            fix = fixes(names, heights(metrics, f'bosses/{world}/'), FIX_BOSS)
            if fix:
                sheets['bosses'][world]['fix'] = fix
            k = sheet_scale(metrics, f'bosses/{world}/', 'boss')
            if k > 1:
                sheets['bosses'][world]['scale'] = k

    env = os.path.join(src, 'environment')
    for stage in sorted(os.listdir(env)) if os.path.isdir(env) else []:
        layers = [l for l in ('far', 'mid', 'ground') if os.path.exists(os.path.join(env, stage, l + '.png'))]
        if len(layers) < 3:
            print(f'  ！{stage} 只有 {layers}，三層都到了才接')
            continue
        for layer in layers:
            im = Image.open(os.path.join(env, stage, layer + '.png'))
            im = im.convert('RGB') if layer == 'far' else load(os.path.join(env, stage, layer + '.png'))
            written.append(save(im, f'stages/{stage}/{layer}.webp'))
        if stage not in sheets['stages']:
            sheets['stages'].append(stage)

    props = os.path.join(src, 'props')
    if os.path.isdir(props):
        for f in sorted(os.listdir(props)):
            if f.endswith('.png'):
                name = f[:-4]
                written.append(save(load(os.path.join(props, f)), f'props/{name}.webp'))
                if name not in sheets['props']:
                    sheets['props'].append(name)
        # 跑酷的道具（尖刺、橫桿、跑道頂面、彈簧、金幣、終點…）：照交件的尺寸存，不套角色的 512×512 定位。
        # 跑道頂面要左右無縫接，用無損 WebP
        d = os.path.join(props, 'runner')
        for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
            if f.endswith('.png'):
                name = f[:-4]
                written.append(save(load(os.path.join(d, f)), f'props/runner/{name}.webp', lossless=name.endswith('platform')))
                if name not in sheets['runner']:
                    sheets['runner'].append(name)
        for sub, key in (('items', 'items'), ('shots', 'shots')):
            d = os.path.join(props, sub)
            for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
                if f.endswith('.png'):
                    name = f[:-4]
                    written.append(save(load(os.path.join(d, f)), f'props/{sub}/{name}.webp'))
                    if name not in sheets[key]:
                        sheets[key].append(name)

    # 介面插圖（Logo、標題主視覺、模式插圖）：Logo 太大了（2000 多寬），縮成 1200 寬就夠清楚
    ui = os.path.join(src, 'ui')
    for f in sorted(os.listdir(ui)) if os.path.isdir(ui) else []:
        if f.endswith('.png'):
            name = f[:-4]
            im = load(os.path.join(ui, f))
            if name == 'logo' and im.width > 1200:
                im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
            elif im.getchannel('A').getextrema()[0] == 255:
                im = im.convert('RGB')
            written.append(save(im, f'ui/{name}.webp'))

    for k in ('stages', 'props', 'items', 'shots', 'runner'):
        sheets[k].sort()
    json.dump(sheets, open(SHEETS, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    files = set(manifest['styles']['anime90']['files'])
    files.update(written)
    manifest['styles']['anime90']['files'] = sorted(files)
    open(MANIFEST, 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'接了 {len(written)} 張圖，sheets.json 與 style-assets.json 已更新')
    if os.path.isdir(chars):
        print('有角色動作圖：記得跑 python scripts/measure-head-scale.py --write，修正各格頭的大小')
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
