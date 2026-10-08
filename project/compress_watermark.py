import os
from PIL import Image, ImageDraw, ImageFont, ImageChops

# د CorelDRAW فایلونو لپاره کتابتون باري کول
try:
    import aspose.imaging as imaging
    from aspose.imaging.imageoptions import VectorRasterizationOptions
except ImportError:
    imaging = None

def trim_white_borders(img):
    """د ډاډ لپاره د عکس له څنډو څخه پاتې شونې اضافي سپین ځایونه پرې کوي"""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    
    bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
    diff = ImageChops.difference(img, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    
    if bbox:
        return img.crop(bbox)
    return img

def process_all_images(input_folder, output_folder, watermark_text):
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        
    try:
        files = os.listdir(input_folder)
    except FileNotFoundError:
        print(f"❌ تېروتنه: د انپوټ فولډر په دې ادرس کې ونه موندل شو: {input_folder}")
        return

    image_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif', '.jfif', '.cdr')
    image_files = [f for f in files if f.lower().endswith(image_extensions)]
    
    if not image_files:
        print(f"⚠️ په '{input_folder}' فولډر کې هیڅ عکس یا CDR فایل ونه موندل شو!")
        return

    print(f"📸 موندل شوي فایلونه: {len(image_files)} دانې. پروسس پیل شو...\n")

    for file_name in image_files:
        input_image_path = os.path.join(input_folder, file_name)
        name_without_ext = os.path.splitext(file_name)[0]
        output_image_path = os.path.join(output_folder, f"{name_without_ext}.webp")
        
        # که د فایل ډول CDR وي
        if file_name.lower().endswith('.cdr'):
            if imaging is None:
                print(f"❌ تېروتنه: د CDR لپاره 'aspose-imaging' انسټال نه دی.")
                continue
            
            print(f"🎨 د CorelDRAW فایل کشف شو: {file_name} (یوازې د اصلي ډیزاین برخه اخیستل کېږي...)")
            temp_png_path = os.path.join(output_folder, f"temp_{name_without_ext}.png")
            
            try:
                # د Aspose په واسطه د CDR خلاصول
                with imaging.Image.load(input_image_path) as cdr_image:
                    
                    # که فایل څو پاڼې ولري، لومړۍ پاڼه رااخیستل
                    if hasattr(cdr_image, 'pages') and len(cdr_image.pages) > 0:
                        first_page = cdr_image.pages[0]
                    else:
                        first_page = cdr_image
                    
                    # هڅه کوو چې د پاڼې پر ځای د ډیزاین د اصلي اندازې (Actual Object Bounds) معلومات ترلاسه کړو
                    # د وبکټور د راسټریز کولو تنظیمات جوړول
                    rasterization_options = VectorRasterizationOptions()
                    
                    # په لومړۍ پاڼه کې د موجودو شیانو د اندازې مطابق د رینډرینګ حدود ټاکل
                    rasterization_options.page_width = float(first_page.width)
                    rasterization_options.page_height = float(first_page.height)
                    
                    png_options = imaging.imageoptions.PngOptions()
                    png_options.vector_rasterization_options = rasterization_options
                    
                    # د لومړۍ پاڼې خوندي کول د موقتي PNG په توګه
                    first_page.save(temp_png_path, png_options)
                
                # اوس د PIL په واسطه د عکس خلاصون، پرې کول او واټر مارک کول
                process_single_pil_image(temp_png_path, output_image_path, watermark_text)
                
                # د موقتي فایل پاکول
                if os.path.exists(temp_png_path):
                    os.remove(temp_png_path)
                    
                print(f"✓ {file_name} په بریا سره په پوره کټ مټ ډیزاین کې .webp ته واړول شو.")
                
            except Exception as e:
                print(f"❌ له CDR فایل {file_name} سره تېروتنه شوه: {e}")
                if os.path.exists(temp_png_path):
                    os.remove(temp_png_path)
                
        else:
            # د عادي عکسونو لپاره پروسه
            process_single_pil_image(input_image_path, output_image_path, watermark_text)


def process_single_pil_image(input_path, output_path, watermark_text):
    """د یو واحد عکس پوره موندل، پرې کول، واټر مارک کول او خوندي کول"""
    try:
        img = Image.open(input_path)
        
        # ۱. د اضافي سپینو ځایونو لیرې کول (Auto-Crop)
        # دا فنکشن به اوس په سمه توګه کار وکړي ځکه عکس د ډیزاین د حدودو مطابق راغلی
        img = trim_white_borders(img)
        
        if img.mode == "CMYK":
            img = img.convert("RGB")
            
        img_rgba = img.convert("RGBA")
        
        # ۲. د واټر مارک لییر جوړول
        txt_layer = Image.new("RGBA", img_rgba.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(txt_layer)
        
        font_size = int(max(img_rgba.size) * 0.035) 
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except IOError:
            font = ImageFont.load_default()

        text_bbox = draw.textbbox((0, 0), watermark_text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        
        x = (img_rgba.size[0] - text_width) // 2
        y = img_rgba.size[1] - text_height - int(img_rgba.size[1] * 0.05)
        
        opacity = 120 
        draw.text((x, y), watermark_text, fill=(255, 255, 255, opacity), font=font)
        
        combined = Image.alpha_composite(img_rgba, txt_layer).convert("RGB")
        
        # ۳. د سایز او کیفیت کنټرول (Target: 200 KB)
        if max(combined.size) > 1920:
            combined.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
            
        quality = 95
        target_size = 200 * 1024
        
        while quality > 10:
            combined.save(output_path, "WEBP", quality=quality)
            current_size = os.path.getsize(output_path)
            if current_size <= target_size:
                break
            quality -= 5
            
        img.close()
    except Exception as e:
        print(f"❌ د عکس په پروسس کې تېروتنه: {e}")

# --- د کوډ رن کول ---
if __name__ == "__main__":
    input_dir = r"C:\Users\PC\Desktop\project\input_images"
    output_dir = r"C:\Users\PC\Desktop\project\output_images"
    watermark_text = "qurishi 3d wall wallpaper"
    
    process_all_images(input_dir, output_dir, watermark_text)
    print("\n🎉 ټول کار په بریالیتوب سره پای ته ورسېد!")