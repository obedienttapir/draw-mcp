"""Adds document metadata and a bookmark outline to the printed review."""
import json, sys
from pypdf import PdfReader, PdfWriter
src, outline_json, out = sys.argv[1], sys.argv[2], sys.argv[3]
reader = PdfReader(src)
writer = PdfWriter(clone_from=reader)
writer.add_metadata({
    '/Title': 'The Basement Cinema — Design Review No. 02',
    '/Subject': 'Furniture, finishes and light: seven furniture collections, five lighting scenes, fireplace wall options A and B, slats behind the TV.',
    '/Keywords': 'home cinema, basement, design review, furniture collections, lighting scenes, fireplace wall, walnut slats, stone slab',
    '/Author': 'Basement Cinema Planner',
    '/Creator': 'Basement Cinema Planner',
})
def add(items, parent=None):
    for it in items:
        node = writer.add_outline_item(it['title'], it['page'] - 1, parent=parent)
        if it.get('kids'):
            add(it['kids'], node)
add(json.load(open(outline_json)))
writer.page_mode = '/UseOutlines'
with open(out, 'wb') as f:
    writer.write(f)
print('wrote', out, len(reader.pages), 'pages')
