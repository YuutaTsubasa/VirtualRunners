#!/usr/bin/env python3
"""把其他畫風（pc98、msdos、taiwan-print、gameboy、modern-paint）的美術包接進遊戲。

用法：python scripts/import-style-art.py art-inbox/pc98-characters.zip pc98

交件結構（requests/2026-10-24-1930-other-styles.md）：包裡是 styles/<風格>/ 底下、跟 90 年代版一樣的資料夾：
  characters/<id>/sprites/<動作>.png、enemies/<大關>/<種類>/<動作>.png、bosses/<大關>/<動作>.png、
  environment/<大關>-<n>/{far,mid,ground}.png、props/…、effects/…、ui/…、ui/icons/…

產出放在 public/styles/<風格>/，路徑跟 90 年代版一樣（遊戲的 asset() 會自動換成這個風格的版本，沒有的退回 90 年代版）。

- 動作圖集照「90 年代版圖集的格子順序」排（src/lib/game/sheets.json），畫面才能用同一份格子名稱找圖。
  跑酷沒用到、這個風格也沒畫的格子（出拳、抓人…）用最接近的跑酷動作補上。
  每個風格自己的圖集資料（格子大小、是不是像素圖）記在 sheets.json 的 styles.<風格>。
- 像素風格（pc98、msdos、gameboy）：交件是邏輯解析度整數倍放大的，這裡用最近鄰縮回邏輯解析度、存無損 WebP，
  畫面再用整數倍、不平滑地放大，輪廓線不會被吃掉。
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

STYLES = ['pc98', 'msdos', 'taiwan-print', 'gameboy', 'modern-paint']
# 像素風格：角色／道具／介面交件是邏輯解析度的幾倍；場景一律 ×4（480×270）
PIXEL = {'pc98': 2, 'msdos': 2, 'gameboy': 4}
SCENE_FACTOR = 4
# 非像素風格的圖集格子大小（跟 90 年代版一樣）
CELL = {'characters': 400, 'enemies': 400, 'bosses': 600}

# 這個風格沒畫的格子用哪一格代替（跑酷用不到的打鬥動作）
FALLBACK = {
    'walk1': 'run1', 'walk2': 'run2', 'walk3': 'run3', 'walk4': 'run4',
    'run5': 'run1', 'run6': 'run2', 'run7': 'run3', 'run8': 'run4',
    'punch1': 'dash', 'punch2': 'dash', 'kick': 'dash', 'throw': 'dash',
    'jumpkick': 'slide', 'special': 'win', 'grab': 'idle', 'knee': 'idle', 'fall': 'hurt',
    'goal': 'win', 'roll': 'jump', 'slide': 'dash',
    'windup': 'idle', 'attack': 'idle', 'charge': 'walk1', 'slam': 'windup', 'leap': 'idle', 'cast': 'windup', 'vanish': 'idle',
}


def load(path):
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v >= 240 else v)
    im.putalpha(a)
    return im


def shrink(im, factor, pixel):
    """像素圖：最近鄰縮回邏輯解析度；一般圖不動"""
    if not pixel or factor == 1:
        return im
    return im.resize((im.width // factor, im.height // factor), Image.NEAREST)


def save(im, rel, pixel):
    out = os.path.join(PUBLIC, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if pixel:
        im.save(out, 'WEBP', lossless=True, method=6)
    else:
        im.save(out, 'WEBP', quality=90, method=6, alpha_quality=95)
    print('  ', rel, im.size)
    return rel.replace(os.sep, '/')


def resolve(name, have, depth=0):
    """這一格要用哪張圖（自己有就用自己的，不然照 FALLBACK 往下找）"""
    if name in have:
        return name
    if depth > 4 or name not in FALLBACK:
        return None
    return resolve(FALLBACK[name], have, depth + 1)


def build_sheet(folder, base, cell, factor, pixel):
    """照 90 年代版圖集（base）的格子順序排一張這個風格的圖集"""
    have = {f[:-4] for f in os.listdir(folder) if f.endswith('.png')}
    if not have:
        return None
    frames, cols = base['frames'], base['cols']
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new('RGBA', (cell * cols, cell * rows), (0, 0, 0, 0))
    cache = {}
    for i, name in enumerate(frames):
        src = resolve(name, have) or resolve('idle', have)
        if not src:
            continue
        if src not in cache:
            im = load(os.path.join(folder, src + '.png'))
            im = shrink(im, factor, pixel) if pixel else im.resize((cell, cell), Image.LANCZOS)
            if im.size != (cell, cell):
                im = im.resize((cell, cell), Image.NEAREST if pixel else Image.LANCZOS)
            cache[src] = im
        sheet.paste(cache[src], ((i % cols) * cell, (i // cols) * cell))
    return sheet


def main(src, style):
    if style not in STYLES:
        sys.exit(f'不認得的風格：{style}（{"、".join(STYLES)}）')
    tmp = None
    if src.endswith('.zip'):
        tmp = tempfile.mkdtemp()
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                if n.startswith('/') or '..' in n.split('/'):
                    sys.exit(f'壓縮檔路徑不安全：{n}')
            z.extractall(tmp)
        src = tmp
    base_dir = os.path.join(src, 'styles', style)
    if not os.path.isdir(base_dir):
        base_dir = src
    pixel = style in PIXEL
    factor = PIXEL.get(style, 1)
    out = f'styles/{style}'

    sheets = json.load(open(SHEETS, encoding='utf-8'))
    mine = sheets.setdefault('styles', {}).setdefault(style, {})
    written = []

    # 動作圖集：角色、敵人、魔王
    for kind, key_of in (('characters', lambda p: p[0]), ('enemies', lambda p: f'{p[0]}/{p[1]}'), ('bosses', lambda p: p[0])):
        top = os.path.join(base_dir, kind)
        if not os.path.isdir(top):
            continue
        folders = []
        for a in sorted(os.listdir(top)):
            if kind == 'enemies':
                folders += [((a, b), os.path.join(top, a, b)) for b in sorted(os.listdir(os.path.join(top, a)))]
            elif kind == 'characters':
                folders.append(((a,), os.path.join(top, a, 'sprites')))
            else:
                folders.append(((a,), os.path.join(top, a)))
        for parts, folder in folders:
            key = key_of(parts)
            base = sheets.get(kind, {}).get(key)
            if not base or not os.path.isdir(folder):
                print(f'  ！{kind}/{key}：90 年代版沒有這張圖集，略過')
                continue
            cell = (base['cell'] * 512 // 400 // factor) if pixel else CELL[kind]
            if kind == 'bosses' and pixel:
                cell = 768 // factor
            sheet = build_sheet(folder, base, cell, factor, pixel)
            if sheet is None:
                continue
            written.append(save(sheet, f"{out}/{base['src']}", pixel))
            entry = {'src': base['src'], 'frames': base['frames'], 'cols': base['cols'], 'cell': cell}
            if pixel:
                entry['pixel'] = True
            mine.setdefault(kind, {})[key] = entry

    # 場景
    env = os.path.join(base_dir, 'environment')
    for stage in sorted(os.listdir(env)) if os.path.isdir(env) else []:
        for layer in ('far', 'mid', 'ground'):
            p = os.path.join(env, stage, layer + '.png')
            if os.path.exists(p):
                im = load(p)
                im = shrink(im, SCENE_FACTOR, pixel)
                written.append(save(im.convert('RGB') if layer == 'far' else im, f'{out}/stages/{stage}/{layer}.webp', pixel))

    # 道具、特效、介面、圖示（照原本的相對路徑）
    for sub in ('props', 'effects', 'ui'):
        top = os.path.join(base_dir, sub)
        for dirpath, _, files in os.walk(top) if os.path.isdir(top) else []:
            for f in sorted(files):
                if not f.endswith('.png'):
                    continue
                rel = os.path.relpath(os.path.join(dirpath, f), base_dir).replace(os.sep, '/')[:-4]
                im = load(os.path.join(dirpath, f))
                f2 = SCENE_FACTOR if rel.endswith('title-scene') or rel.startswith('ui/mode-') else factor
                im = shrink(im, f2, pixel)
                if im.getchannel('A').getextrema()[0] == 255:
                    im = im.convert('RGB')
                written.append(save(im, f'{out}/{rel}.webp', pixel))

    json.dump(sheets, open(SHEETS, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    st = manifest['styles'].setdefault(style, {})
    # manifest 記的是不含 styles/<風格>/ 的路徑（跟 90 年代版一樣）
    st['files'] = sorted(set(st.get('files', [])) | {w[len(out) + 1:] for w in written})
    open(MANIFEST, 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'{style}：接了 {len(written)} 張圖，sheets.json 與 style-assets.json 已更新')
    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
