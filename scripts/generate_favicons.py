import os
import cv2
import numpy as np
from PIL import Image

def generate_assets():
    # 1. Load official MomSafe logo mark
    src_path = os.path.join("attached_assets", "momsafe-official-logo-mark.png")
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source file not found: {src_path}")
    
    img = Image.open(src_path).convert("RGB")
    arr = np.array(img, dtype=float)
    
    # Background and foreground color vectors from official asset
    bg = np.array([245.0, 248.0, 247.0])
    fg = np.array([15.0, 72.0, 87.0]) # Brand Teal #0f4857
    
    v = fg - bg
    v_norm_sq = np.sum(v**2)
    diff = arr - bg
    proj = np.sum(diff * v, axis=-1) / v_norm_sq
    alpha = np.clip(proj, 0.0, 1.0)
    
    # Clean RGBA
    rgba = np.zeros((1024, 1024, 4), dtype=np.uint8)
    rgba[:, :, 0] = int(fg[0])
    rgba[:, :, 1] = int(fg[1])
    rgba[:, :, 2] = int(fg[2])
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
    
    clean_img = Image.fromarray(rgba, "RGBA")
    bbox = clean_img.getbbox()
    cropped = clean_img.crop(bbox)
    cw, ch = cropped.size
    
    # 2. Master Canvas 1024x1024, centered, 80% height padding
    target_h = int(1024 * 0.80)
    target_w = int(cw * (target_h / ch))
    scaled_crop = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    master = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    offset_x = (1024 - target_w) // 2
    offset_y = (1024 - target_h) // 2
    master.paste(scaled_crop, (offset_x, offset_y), scaled_crop)
    
    # Targets in public directory
    public_dir = os.path.join("artifacts", "momsafe-ai", "public")
    os.makedirs(public_dir, exist_ok=True)
    
    # 3. Generate PNG sizes
    sizes = {
        "icon-512.png": (512, 512),
        "icon-192.png": (192, 192),
        "apple-touch-icon.png": (180, 180),
        "favicon-32x32.png": (32, 32),
        "favicon-16x16.png": (16, 16),
    }
    
    for filename, (w, h) in sizes.items():
        resized = master.resize((w, h), Image.Resampling.LANCZOS)
        out_path = os.path.join(public_dir, filename)
        resized.save(out_path, format="PNG", optimize=True)
        print(f"Generated {out_path} ({w}x{h})")
        
    # 4. Generate multi-resolution favicon.ico (16x16, 32x32, 48x48)
    ico_img_48 = master.resize((48, 48), Image.Resampling.LANCZOS)
    ico_path = os.path.join(public_dir, "favicon.ico")
    ico_img_48.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Generated {ico_path} (16x16, 32x32, 48x48)")
    
    # 5. Generate vector favicon.svg from master contours
    master_arr = np.array(master)
    alpha_chan = master_arr[:, :, 3]
    _, thresh = cv2.threshold(alpha_chan, 128, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    
    svg_lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="none">',
    ]
    
    # Sort contours by y-coordinate (top to bottom)
    sorted_contours = sorted(contours, key=lambda c: cv2.boundingRect(c)[1])
    for c in sorted_contours:
        approx = cv2.approxPolyDP(c, 0.5, True)
        pts = approx.reshape(-1, 2)
        d = f"M {pts[0][0]} {pts[0][1]} " + " ".join([f"L {p[0]} {p[1]}" for p in pts[1:]]) + " Z"
        svg_lines.append(f'  <path d="{d}" fill="#0f4857"/>')
        
    svg_lines.append("</svg>\n")
    svg_path = os.path.join(public_dir, "favicon.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write("\n".join(svg_lines))
    print(f"Generated {svg_path} (SVG vector)")

    print("\n--- Verifying Assets ---")
    files = [
        "favicon.ico",
        "favicon.svg",
        "favicon-32x32.png",
        "favicon-16x16.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png"
    ]
    for fname in files:
        fpath = os.path.join(public_dir, fname)
        size = os.path.getsize(fpath)
        if fname.endswith(".png"):
            with Image.open(fpath) as im:
                print(f"{fname:22} | {size:6} bytes | {im.size} | {im.mode}")
        elif fname.endswith(".ico"):
            with Image.open(fpath) as im:
                print(f"{fname:22} | {size:6} bytes | Sizes: {im.info.get('sizes')}")
        else:
            print(f"{fname:22} | {size:6} bytes | Vector SVG")

if __name__ == "__main__":
    generate_assets()

