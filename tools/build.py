# -*- coding: utf-8 -*-
"""
楊梅高中紅土藝術空間 網站建置工具

來源：../紅土藝術空間/<期別>(<展名>)/<期別>(<展名>)<海報|邀請卡正面|邀請卡背面|小卡正面|小卡背面><流水號>.JPG
輸出：img/web/<期別>/*.webp（大圖）、img/thumb/<期別>/*.webp（縮圖）、data/exhibitions.js

新增期別：把新資料夾放進「紅土藝術空間」後，雙擊「更新網站.bat」即可（只處理新增/變更的圖片）。
展名、藝術家、展期、簡介、分類可在 data/meta.json 手動覆寫。
"""
import json, os, re, subprocess, sys, time, colorsys
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True   # 部分原始 JPG 檔尾不完整
Image.MAX_IMAGE_PIXELS = None

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(SITE)
SRC = os.path.join(ROOT, '紅土藝術空間')
BADGE = os.path.join(ROOT, '校徽.jpg')
WEB, THUMB = os.path.join(SITE, 'img', 'web'), os.path.join(SITE, 'img', 'thumb')
OCRDIR = os.path.join(SITE, 'data', 'ocr')
TMP = os.path.join(SITE, 'tools', '_ocrtmp')
WEB_MAX, THUMB_MAX, OCR_MAX = 1600, 520, 3200

KINDS = [('海報', 'poster'), ('邀請卡正面', 'invite-front'), ('邀請卡背面', 'invite-back'),
         ('小卡正面', 'card-front'), ('小卡背面', 'card-back')]
KIND_ORDER = {k: i for i, (_, k) in enumerate(KINDS)}
FILE_RE = re.compile(r'^(\d{5})\((.*)\)(海報|邀請卡正面|邀請卡背面|小卡正面|小卡背面)\s*(\d+)\.(jpe?g|png)$', re.I)
DIR_RE = re.compile(r'^(\d{5})\s*\((.*)\)\s*$')

CATEGORIES = [  # (分類, 關鍵字) 依序比對
    ('班級展', ['班展', '班級', '美術班', '陸藝', '藝文月']),
    ('校友展', ['校友']),
    ('學生成果', ['學生', '成果', '就是愛畫繪']),
    ('聯展', ['聯展', '雙人展', '+', '與', '藝樂園', '學會']),
    ('攝影展', ['攝影']),
    ('講座／特展', ['講座', '特展', '校慶', '想像力', '好竹藝', '大明遺風', '舞筆弄墨']),
    ('個展', ['個展', '畫展', '創作展', '個人', '繪本', '人生', '週年']),
]


def log(*a):
    print(*a, flush=True)


def clean_title(t):
    t = t.strip()
    while t.endswith(')') and t.count(')') > t.count('('):
        t = t[:-1]
    return t.replace('_', '・')


SURNAMES = set('王李張劉陳楊黃趙吳周徐孫馬朱胡郭何高林羅鄭梁謝宋唐許韓馮鄧曹彭曾蕭田董袁潘蔡蔣余杜葉程蘇魏呂丁任沈姚盧姜崔鍾譚陸汪范金石廖賈夏韋付方白鄒孟熊秦邱江尹薛閻段雷侯龍史陶黎賀顧毛郝龔邵萬錢嚴覃武戴莫孔向湯詹柯莊游賴翁洪施傅簡')


def guess_artist(title):
    """由展名推測藝術家（僅供參考，可用 meta.json 覆寫）"""
    t = re.sub(r'^\d+', '', title)
    t = re.sub(r'[「」：:]', '-', t)
    parts = [p for p in re.split(r'[—\-・]', t) if p]
    found = []
    for p in parts:
        p = re.sub(r'(老師)?(個人創作展|創作展|個展畫作|個展|畫展|油畫創作展|聯展|雙人展|創作\d+週年|繪本|梅高之美攝影展|楊梅小個展|之攝影與水彩聯展)$', '', p)
        for n in re.split(r'[+與]', p):
            if re.fullmatch(r'[一-鿿]{3}', n) and n[0] in SURNAMES:
                found.append(n)
            elif m := re.search(r'([一-鿿]{3})$', n):
                if m.group(1)[0] in SURNAMES and len(n) <= 5 and not re.search(r'班|校|學|會', n):
                    found.append(m.group(1))
    return '、'.join(dict.fromkeys(found))


def category(title):
    for cat, kws in CATEGORIES:
        if any(k in title for k in kws):
            return cat
    return '主題展'


def load(path):
    im = Image.open(path)
    im.draft('RGB', (OCR_MAX, OCR_MAX))
    im = im.convert('RGB')
    return im


def fit(im, m):
    im = im.copy()
    im.thumbnail((m, m), Image.LANCZOS)
    return im


def dominant(im):
    """海報主色：取飽和度高的像素平均，作為展覽卡片的主題色"""
    small = fit(im, 64)
    best, score = (156, 101, 185), 0
    buckets = {}
    for r, g, b in small.getdata():
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if s < .35 or v < .35:
            continue
        k = int(h * 12)
        e = buckets.setdefault(k, [0, 0, 0, 0])
        e[0] += r; e[1] += g; e[2] += b; e[3] += 1
    for k, (r, g, b, n) in buckets.items():
        if n > score:
            score, best = n, (r // n, g // n, b // n)
    # 讓顏色夠亮但不刺眼
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in best))
    r, g, b = colorsys.hsv_to_rgb(h, min(max(s, .5), .78), min(max(v, .7), .86))
    return '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))


def make_badge():
    out = os.path.join(SITE, 'assets', 'badge.png')
    if not os.path.exists(BADGE) or (os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(BADGE)):
        return
    im = Image.open(BADGE).convert('RGBA')
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    w, h = im.size
    px = im.load()
    # 從四角 flood-fill 把外圍白底去掉（三角形內的白字保留）
    seen, stack = set(), [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        r, g, b, a = px[x, y]
        if min(r, g, b) > 200 and max(r, g, b) - min(r, g, b) < 40:
            px[x, y] = (255, 255, 255, 0)
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        elif min(r, g, b) > 150:   # 反鋸齒邊緣：半透明
            px[x, y] = (r, g, b, int(255 * (1 - (min(r, g, b) - 150) / 105)))
    im = im.crop(im.getbbox())
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, optimize=True)
    log('校徽 → assets/badge.png')


def scan():
    exhibits = []
    for d in sorted(os.listdir(SRC)):
        p = os.path.join(SRC, d)
        m = DIR_RE.match(d)
        if not os.path.isdir(p) or not m:
            continue
        code, title = m.group(1), clean_title(m.group(2))
        items = []
        for f in os.listdir(p):
            fm = FILE_RE.match(f)
            if not fm:
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    log('  ⚠ 檔名格式不符，略過：', d, '/', f)
                continue
            kind = dict(KINDS)[fm.group(3)]
            items.append({'src': os.path.join(p, f), 'file': f, 'kind': kind, 'label': fm.group(3), 'n': int(fm.group(4))})
        items.sort(key=lambda it: (KIND_ORDER[it['kind']], it['n']))
        exhibits.append({'code': code, 'dir': d, 'title': title, 'items': items})
    return exhibits


def slug(it):
    return '%s-%d' % (it['kind'], it['n'])


def process_images(exhibits, cache):
    todo_ocr = []
    t0 = time.time()
    done = 0
    for ex in exhibits:
        for it in ex['items']:
            key = ex['code'] + '/' + slug(it)
            st = os.stat(it['src'])
            sig = '%d-%d' % (st.st_size, int(st.st_mtime))
            web = os.path.join(WEB, ex['code'], slug(it) + '.webp')
            th = os.path.join(THUMB, ex['code'], slug(it) + '.webp')
            ocrj = os.path.join(OCRDIR, ex['code'] + '_' + slug(it) + '.json')
            c = cache.get(key)
            if c and c.get('sig') == sig and os.path.exists(web) and os.path.exists(th):
                it.update(w=c['w'], h=c['h'], color=c.get('color'))
            else:
                im = load(it['src'])
                os.makedirs(os.path.dirname(web), exist_ok=True)
                os.makedirs(os.path.dirname(th), exist_ok=True)
                wi = fit(im, WEB_MAX); wi.save(web, 'WEBP', quality=82, method=5)
                fit(im, THUMB_MAX).save(th, 'WEBP', quality=78, method=5)
                color = dominant(wi)
                it.update(w=wi.width, h=wi.height, color=color)
                cache[key] = {'sig': sig, 'w': wi.width, 'h': wi.height, 'color': color}
                if os.path.exists(ocrj):
                    os.remove(ocrj)
                done += 1
                if not os.path.exists(ocrj):
                    os.makedirs(TMP, exist_ok=True)
                    tmp = os.path.join(TMP, ex['code'] + '_' + slug(it) + '.jpg')
                    fit(im, OCR_MAX).save(tmp, quality=90)
                    todo_ocr.append((tmp, ocrj))
                log('  🖼 %s %s (%d×%d)' % (ex['code'], it['label'] + str(it['n']), wi.width, wi.height))
            if not os.path.exists(ocrj) and not any(o == ocrj for _, o in todo_ocr):
                os.makedirs(TMP, exist_ok=True)
                tmp = os.path.join(TMP, ex['code'] + '_' + slug(it) + '.jpg')
                fit(load(it['src']), OCR_MAX).save(tmp, quality=90)
                todo_ocr.append((tmp, ocrj))
    log('圖片：新處理 %d 張（%.0f 秒）' % (done, time.time() - t0))
    return todo_ocr


def run_ocr(todo):
    if not todo:
        log('OCR：無需更新')
        return
    os.makedirs(OCRDIR, exist_ok=True)
    lst = os.path.join(TMP, 'list.txt')
    with open(lst, 'w', encoding='utf-8') as f:
        for a, b in todo:
            f.write(a + '\t' + b + '\n')
    log('OCR：辨識 %d 張（Windows 內建 OCR）…' % len(todo))
    t0 = time.time()
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                    os.path.join(SITE, 'tools', 'ocr.ps1'), lst], check=False)
    log('OCR 完成（%.0f 秒）' % (time.time() - t0))
    for a, _ in todo:
        try: os.remove(a)
        except OSError: pass


CN_NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10}


def guess_period(text, roc):
    """從海報/邀請卡文字推測展期，例：5/9-6/30、2026.03.02~03.27"""
    t = text.replace(' ', '')
    t = re.sub(r'[．。·•]', '.', t)
    pats = [
        r'(?:(\d{2,4})[./年])?(\d{1,2})[./月](\d{1,2})日?(?:\([^)]{1,3}\)|（[^）]{1,3}）)?[~～\-–—至到](?:(\d{2,4})[./年])?(\d{1,2})[./月](\d{1,2})日?',
    ]
    for p in pats:
        for m in re.finditer(p, t):
            y1, m1, d1, y2, m2, d2 = m.groups()
            m1, d1, m2, d2 = int(m1), int(d1), int(m2), int(d2)
            if not (1 <= m1 <= 12 and 1 <= m2 <= 12 and 1 <= d1 <= 31 and 1 <= d2 <= 31):
                continue
            if (m2, d2) < (m1, d1) and not y2:
                continue
            if y1 and len(y1) == 4 and abs(int(y1) - 1911 - roc) > 1:
                continue
            return '%d/%d – %d/%d' % (m1, d1, m2, d2)
    return ''


def cover_color(code, cover):
    if not cover:
        return '#9466b4'
    p = os.path.join(THUMB, code, cover['id'] + '.webp')
    try:
        return dominant(Image.open(p).convert('RGB'))
    except Exception:
        return cover.get('color') or '#9466b4'


def build_data(exhibits):
    meta_path = os.path.join(SITE, 'data', 'meta.json')
    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path, encoding='utf-8') as f:
            meta = {k: v for k, v in json.load(f).items() if not k.startswith('_')}
    out, texts = [], {}
    for ex in exhibits:
        roc = int(ex['code'][:3])
        text_all = []
        items = []
        for it in ex['items']:
            s = slug(it)
            ocrj = os.path.join(OCRDIR, ex['code'] + '_' + s + '.json')
            lines = []
            if os.path.exists(ocrj):
                try:
                    with open(ocrj, encoding='utf-8-sig') as f:
                        lines = json.load(f).get('lines', [])
                except Exception:
                    lines = []
            txt = '\n'.join(lines)
            text_all.append(txt)
            texts[ex['code'] + '/' + s] = txt
            items.append({'id': s, 'kind': it['kind'], 'label': it['label'], 'n': it['n'], 'file': it['file'],
                          'w': it.get('w'), 'h': it.get('h'), 'color': it.get('color')})
        cover = next((i for i in items if i['kind'] == 'poster'), None) or \
            next((i for i in items if i['kind'].endswith('front')), None) or (items[0] if items else None)
        e = {
            'code': ex['code'], 'dir': ex['dir'], 'roc': roc, 'year': roc + 1911, 'seq': int(ex['code'][3:]),
            'title': ex['title'], 'artist': guess_artist(ex['title']), 'category': category(ex['title']),
            'period': guess_period('\n'.join(text_all), roc), 'periodGuess': True, 'intro': '',
            'cover': cover['id'] if cover else '', 'color': cover_color(ex['code'], cover),
            'items': items,
        }
        m = meta.get(ex['code'], {})
        for k in ('title', 'artist', 'category', 'period', 'intro', 'color', 'cover'):
            if m.get(k):
                e[k] = m[k]
                if k == 'period':
                    e['periodGuess'] = False
        out.append(e)
    os.makedirs(os.path.join(SITE, 'data'), exist_ok=True)
    stamp = time.strftime('%Y-%m-%d %H:%M')
    with open(os.path.join(SITE, 'data', 'exhibitions.js'), 'w', encoding='utf-8') as f:
        f.write('/* 自動產生：tools/build.py（%s）請勿手動編輯，覆寫請用 data/meta.json */\n' % stamp)
        f.write('window.HONGTU = ' + json.dumps({'updated': stamp, 'exhibitions': out}, ensure_ascii=False, separators=(',', ':')) + ';\n')
    with open(os.path.join(SITE, 'data', 'texts.js'), 'w', encoding='utf-8') as f:
        f.write('window.HONGTU_TEXT = ' + json.dumps(texts, ensure_ascii=False, separators=(',', ':')) + ';\n')
    # 讓瀏覽器重新載入資料
    idx = os.path.join(SITE, 'index.html')
    if os.path.exists(idx):
        with open(idx, encoding='utf-8') as f:
            h = f.read()
        v = str(int(time.time()))
        h = re.sub(r'(data/(?:exhibitions|texts)\.js)(\?v=\d+)?', r'\1?v=' + v, h)
        with open(idx, 'w', encoding='utf-8') as f:
            f.write(h)
    if not os.path.exists(meta_path):
        tmpl = {'_說明': '以期別代碼為鍵，可覆寫 title/artist/category/period/intro/color/cover，例如下方範例（移除開頭底線即生效）',
                '_11501': {'artist': '羅桂蘭', 'period': '3/2 – 3/27', 'intro': '展覽簡介文字'}}
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(tmpl, f, ensure_ascii=False, indent=2)
    n_img = sum(len(e['items']) for e in out)
    log('資料：%d 期展覽、%d 張圖片 → data/exhibitions.js' % (len(out), n_img))


def main():
    if not os.path.isdir(SRC):
        log('找不到來源資料夾：', SRC); sys.exit(1)
    make_badge()
    cache_path = os.path.join(SITE, 'data', 'cache.json')
    cache = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding='utf-8') as f:
            cache = json.load(f)
    exhibits = scan()
    log('掃描到 %d 個期別資料夾' % len(exhibits))
    todo = process_images(exhibits, cache)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False)
    if '--no-ocr' not in sys.argv:
        run_ocr(todo)
    build_data(exhibits)


if __name__ == '__main__':
    main()
