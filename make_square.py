from PIL import Image
import sys

img_path = sys.argv[1]
out_path = sys.argv[2]

img = Image.open(img_path)
width, height = img.size

if width == height:
    img.save(out_path)
else:
    size = max(width, height)
    new_img = Image.new("RGBA", (size, size), (0, 0, 0, 0)) # transparent background
    new_img.paste(img, ((size - width) // 2, (size - height) // 2))
    new_img.save(out_path)
