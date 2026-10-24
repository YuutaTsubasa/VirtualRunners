"""把一包風格圖素（ChatGPT 交到 art-inbox 的 zip 或資料夾）接進遊戲。

用法：
    python -P scripts/import-style.py <zip 或資料夾> <風格> [--config '{"scoreboard": {...}}']

例：
    python -P scripts/import-style.py art-inbox/pc98-assets.zip pc98 --config '{"canvasScale": 0.5}'
    python -P scripts/import-style.py art-inbox/anime90-ui anime90

做的事：
1. 找到圖素包根目錄（含 characters/、environment/、ui/ 任一個的資料夾）。
2. 角色 ID 對應（01-wolf → cangya 等），半身像轉 WebP；8 張動作圖排成 4096×512 圖集。
3. 球場、球網、球、特效、介面、圖示轉 WebP。像素風格用最近鄰縮放＋無損 WebP，不會糊。
4. anime90 放在 public/ 底下；其他風格放在 public/styles/<風格>/。
5. 把這個風格實際有的檔案（與 --config 給的畫面設定）寫進 src/lib/style-assets.json。
6. 圖素包的說明、清單、提示詞複製到 docs/art/<風格>-<版本>/。
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
STYLES = ['anime90', 'pc98', 'msdos', 'taiwan-print', 'gameboy', 'modern-paint']
PIXEL = {'pc98', 'msdos', 'gameboy'}
ID_MAP = {'01-wolf': 'cangya', '02-gambler': 'jinye', '03-prince': 'leo', '04-adventurer': 'alie'}
CHARACTERS = ['xiaocui', 'yuehua', 'aming', 'tangtang', 'xiaochun', 'lanjie', 'cangya', 'jinye', 'leo', 'alie', 'ayi']
FRAMES = ['idle', 'run1', 'run2', 'jump', 'spike', 'dive', 'win', 'lose']
EXPRESSIONS = ['normal', 'happy', 'surprised', 'sad', 'win']
ENVIRONMENT = ['court', 'net', 'ball']
EFFECTS = ['hit-spark', 'sand-puff', 'score-burst', 'spike-trail']
UI = ['logo', 'score-panel', 'result-banner', 'portrait-frame', 'portrait-selected',
      'title-scene', 'mode-cpu', 'mode-versus', 'mode-watch']
ICONS = ['keyboard', 'gamepad', 'touch', 'lock', 'ready', 'pause', 'sound-on', 'sound-off', 'back', 'settings', 'watch']


def find_root(path: Path) -> Path:
    for p in [path, *sorted(path.rglob('*'))]:
        if p.is_dir() and any((p / d).is_dir() for d in ('characters', 'environment', 'ui', 'effects')):
            return p
    # 只有介面圖（例如 anime90-ui）：直接放在根目錄的 PNG
    return path


def first(*candidates):
    for c in candidates:
        if c and c.exists():
            return c
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('style', choices=STYLES)
    ap.add_argument('--config', default='{}', help='畫面設定 JSON，例如比分底板數字位置、球網座標、canvasScale')
    ap.add_argument('--version', default='v1')
    args = ap.parse_args()

    style = args.style
    pixel = style in PIXEL
    src = Path(args.source).resolve()
    tmp = None
    if src.suffix.lower() == '.zip':
        tmp = Path(tempfile.mkdtemp(prefix=f'style-{style}-'))
        with zipfile.ZipFile(src) as z:
            for n in z.namelist():
                if n.startswith('/') or '..' in Path(n).parts:
                    sys.exit(f'壓縮檔裡有不安全的路徑：{n}')
            z.extractall(tmp)
        src = tmp
    root = find_root(src)
    out = REPO / 'public' if style == 'anime90' else REPO / 'public' / 'styles' / style
    files, missing = [], []

    def save(im: Image.Image, rel: str, quality=90):
        dest = out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if pixel:
            im.save(dest, 'WEBP', lossless=True, method=6)
        else:
            im.save(dest, 'WEBP', quality=quality, method=6)
        files.append(rel)

    def resized(im: Image.Image, size):
        return im.resize(size, Image.NEAREST if pixel else Image.LANCZOS)

    # 角色
    char_dirs = {}
    if (root / 'characters').is_dir():
        for d in (root / 'characters').iterdir():
            if d.is_dir():
                char_dirs[ID_MAP.get(d.name, d.name)] = d
    for cid in CHARACTERS:
        d = char_dirs.get(cid)
        if d is None:
            if char_dirs:
                missing.append(f'角色 {cid}')
            continue
        for e in EXPRESSIONS:
            f = first(d / 'portraits' / f'{e}.png', d / f'portrait-{e}.png')
            if f:
                im = Image.open(f).convert('RGBA')
                save(im if im.size == (512, 512) else resized(im, (512, 512)), f'characters/{cid}/{e}.webp')
            else:
                missing.append(f'{cid} 表情 {e}')
        sheet = Image.new('RGBA', (512 * len(FRAMES), 512), (0, 0, 0, 0))
        have = 0
        for i, fr in enumerate(FRAMES):
            f = first(d / 'sprites' / f'{fr}.png')
            if not f:
                missing.append(f'{cid} 動作 {fr}')
                continue
            im = Image.open(f).convert('RGBA')
            if im.size != (512, 512):
                im = resized(im, (512, 512))
            sheet.alpha_composite(im, (i * 512, 0))
            have += 1
        if have == len(FRAMES):
            save(sheet, f'sprites/{cid}.webp')
        elif have:
            missing.append(f'{cid} 圖集不完整（{have}/8），先不用')

    # 環境、特效、介面、圖示
    for name in ENVIRONMENT:
        f = first(root / 'environment' / f'{name}.png', root / f'{name}.png')
        if f:
            save(Image.open(f).convert('RGBA'), f'game/{name}.webp', 88 if name == 'court' else 92)
        elif style != 'anime90':
            missing.append(f'environment/{name}')
    for name in EFFECTS:
        f = first(root / 'effects' / f'{name}.png', root / f'{name}.png')
        if f:
            save(Image.open(f).convert('RGBA'), f'effects/{name}.webp')
        elif style != 'anime90':
            missing.append(f'effects/{name}')
    for name in UI:
        f = first(root / 'ui' / f'{name}.png', root / f'{name}.png')
        if f:
            save(Image.open(f).convert('RGBA'), f'ui/{name}.webp', 90)
        elif style != 'anime90' and not name.startswith(('title-', 'mode-')):
            missing.append(f'ui/{name}')
    for name in ICONS:
        f = first(root / 'ui' / 'icons' / f'{name}.png', root / 'ui' / 'icons-extra' / f'{name}.png', root / 'icons' / f'{name}.png')
        if f:
            save(resized(Image.open(f).convert('RGBA'), (128, 128)), f'ui/icons/{name}.webp', 92)
        elif style != 'anime90' and name != 'watch':
            missing.append(f'ui/icons/{name}')

    # 清單
    manifest_path = REPO / 'src' / 'lib' / 'style-assets.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    entry = manifest.setdefault('styles', {}).setdefault(style, {})
    entry['files'] = sorted(set(entry.get('files', [])) | set(files))
    config = json.loads(args.config)
    if config:
        entry['config'] = {**entry.get('config', {}), **config}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # 說明與提示詞
    docs = REPO / 'docs' / 'art' / f'{style}-{args.version}'
    docs.mkdir(parents=True, exist_ok=True)
    for p in root.rglob('*'):
        if p.is_file() and (p.suffix.lower() in ('.md', '.txt', '.json') or 'prompt' in p.name.lower()):
            rel = p.relative_to(root)
            if len(rel.parts) > 6:
                continue
            dest = docs / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dest)

    if tmp:
        shutil.rmtree(tmp, ignore_errors=True)
    size = sum((out / f).stat().st_size for f in files)
    print(f'{style}：接了 {len(files)} 個檔案（{size / 1e6:.1f} MB），清單共 {len(entry["files"])} 個')
    if missing:
        print('缺少（先用 90 年代版）：')
        for m in missing:
            print('  -', m)


if __name__ == '__main__':
    main()
