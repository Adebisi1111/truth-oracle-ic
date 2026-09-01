from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

# Create image
size = 512
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background gradient (purple to pink)
for y in range(size):
    r = int(88 + (232 - 88) * (y / size))
    g = int(28 + (72 - 28) * (y / size))
    b = int(135 + (153 - 135) * (y / size))
    draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

# Draw outer circle
draw.ellipse([40, 40, size-40, size-40], fill=(255, 255, 255, 30), outline=(255, 255, 255, 60), width=4)

# Draw inner circle
draw.ellipse([80, 80, size-80, size-80], fill=(255, 255, 255, 20))

# Draw checkmark / verification symbol
# Simple checkmark shape
checkmark_color = (255, 255, 255, 255)
draw.line([(180, 260), (240, 320), (340, 200)], fill=checkmark_color, width=20)

# Draw "T" in center-top
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
except:
    font = ImageFont.load_default()

bbox = draw.textbbox((0, 0), "T", font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
x = (size - tw) / 2 - bbox[0]
y = 80
draw.text((x, y), "T", fill=(255, 255, 255, 255), font=font)

# Save
img.save('/home/administrator/truth-oracle-ic/docs/assets/logo.png', 'PNG')
print("Logo saved!")
