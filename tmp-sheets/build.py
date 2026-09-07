import json, io, requests
from PIL import Image, ImageDraw, ImageFont
B = "https://mkfztwibolswqcggukeq.supabase.co/storage/v1/object/public/catalogue-images/"
d = json.load(open("tmp-sheets/products.json"))
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
except Exception:
    font = ImageFont.load_default()
S = 420; COLS = 4
for pid, p in d.items():
    imgs = [("main", p["main"])] + [(f"galerie {i+1}", u) for i, u in enumerate(p["gallery"])] + [(f"variante: {v[0]}", v[1]) for v in p["variants"]]
    rows = (len(imgs) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * S, rows * (S + 30) + 40), "white")
    dr = ImageDraw.Draw(sheet)
    dr.text((10, 8), f"{p['sku']}  {p['cat']}  {p['dims']}  moq {p['moq']}  base {p['base']} retail {p['retail']}", fill="black", font=font)
    for i, (lab, u) in enumerate(imgs):
        x = (i % COLS) * S; y = 40 + (i // COLS) * (S + 30)
        try:
            r = requests.get(B + u, headers={"User-Agent": "Mozilla/5.0"}, timeout=30); r.raise_for_status()
            im = Image.open(io.BytesIO(r.content)).convert("RGB"); im.thumbnail((S - 8, S - 8))
            sheet.paste(im, (x + 4, y + 4))
        except Exception as e:
            dr.text((x + 10, y + 10), f"ERR {e}"[:60], fill="red", font=font)
        dr.text((x + 6, y + S + 4), lab[:40], fill="black", font=font)
    sheet.save(f"tmp-sheets/{pid}.jpg", quality=82)
    print("ok", pid)
