import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS_MAIN = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
NS_REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def cell_value(cell, shared):
    t = cell.attrib.get('t')
    v = cell.find(f'{NS_MAIN}v')
    if v is None:
        is_node = cell.find(f'{NS_MAIN}is')
        if is_node is not None:
            t_node = is_node.find(f'{NS_MAIN}t')
            if t_node is not None and t_node.text:
                return t_node.text
        return ''
    text = v.text or ''
    if t == 's':
        try:
            return shared[int(text)]
        except Exception:
            return ''
    return text


def col_idx(cell_ref):
    m = re.match(r'([A-Z]+)', cell_ref)
    if not m:
        return 0
    letters = m.group(1)
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - ord('A') + 1)
    return idx


def read_shared_strings(zf):
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return []
    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    result = []
    for si in root.findall(f'{NS_MAIN}si'):
        texts = []
        t = si.find(f'{NS_MAIN}t')
        if t is not None and t.text:
            texts.append(t.text)
        for r in si.findall(f'{NS_MAIN}r'):
            rt = r.find(f'{NS_MAIN}t')
            if rt is not None and rt.text:
                texts.append(rt.text)
        result.append(''.join(texts))
    return result


def parse_sheet(zf, shared):
    root = ET.fromstring(zf.read('xl/worksheets/sheet1.xml'))
    rows = {}
    sheet_data = root.find(f'{NS_MAIN}sheetData')
    if sheet_data is None:
        return {}, root

    for row in sheet_data.findall(f'{NS_MAIN}row'):
        rnum = int(row.attrib.get('r', '0'))
        cells = {}
        for c in row.findall(f'{NS_MAIN}c'):
            ref = c.attrib.get('r', '')
            idx = col_idx(ref)
            cells[idx] = cell_value(c, shared).strip()
        rows[rnum] = cells
    return rows, root


def parse_relationships(xml_bytes):
    rel_root = ET.fromstring(xml_bytes)
    rels = {}
    for rel in rel_root:
        rid = rel.attrib.get('Id')
        target = rel.attrib.get('Target')
        if rid and target:
            rels[rid] = target
    return rels


def load_row_images(zf, sheet_root):
    drawing = sheet_root.find(f'{NS_MAIN}drawing')
    if drawing is None:
        return {}
    drawing_rid = drawing.attrib.get(f'{NS_REL}id')
    if not drawing_rid:
        return {}

    sheet_rels_path = 'xl/worksheets/_rels/sheet1.xml.rels'
    if sheet_rels_path not in zf.namelist():
        return {}
    sheet_rels = parse_relationships(zf.read(sheet_rels_path))
    drawing_target = sheet_rels.get(drawing_rid)
    if not drawing_target:
        return {}

    drawing_path = os.path.normpath(os.path.join('xl/worksheets', drawing_target)).replace('\\', '/')
    if drawing_path not in zf.namelist():
        return {}

    drawing_root = ET.fromstring(zf.read(drawing_path))
    drawing_rels_path = os.path.normpath(os.path.join(os.path.dirname(drawing_path), '_rels', os.path.basename(drawing_path) + '.rels')).replace('\\', '/')
    if drawing_rels_path not in zf.namelist():
        return {}
    drawing_rels = parse_relationships(zf.read(drawing_rels_path))

    row_images = {}
    for anchor in drawing_root:
        from_node = anchor.find('{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}from')
        pic = anchor.find('{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}pic')
        if from_node is None or pic is None:
            continue
        row_node = from_node.find('{http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing}row')
        if row_node is None:
            continue
        row_num = int(row_node.text) + 1

        blip = pic.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip')
        if blip is None:
            continue
        embed = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        target = drawing_rels.get(embed)
        if not target:
            continue

        media_path = os.path.normpath(os.path.join(os.path.dirname(drawing_path), target)).replace('\\', '/')
        if media_path in zf.namelist():
            row_images[row_num] = zf.read(media_path)

    return row_images


def safe_name(value):
    return re.sub(r'[^a-zA-Z0-9_.-]', '_', value.strip())


def main():
    if len(sys.argv) < 3:
        print(json.dumps({'ok': False, 'message': 'Usage: xlsx_parser.py <xlsx_path> <output_dir>'}))
        return 1

    xlsx_path = sys.argv[1]
    output_dir = sys.argv[2]

    required_headers = ['Код', 'Номенклатура', 'Штук', 'Цена']

    with zipfile.ZipFile(xlsx_path, 'r') as zf:
        shared = read_shared_strings(zf)
        rows, sheet_root = parse_sheet(zf, shared)
        row_images = load_row_images(zf, sheet_root)

        headers = rows.get(1, {})
        header_map = {v: k for k, v in headers.items() if v}
        missing = [h for h in required_headers if h not in header_map]
        if missing:
            print(json.dumps({'ok': False, 'message': f"Excel header missing: {', '.join(missing)}"}, ensure_ascii=False))
            return 2

        code_col = header_map['Код']
        name_col = header_map['Номенклатура']
        stock_col = header_map['Штук']
        price_col = header_map['Цена']

        current_category = 'Boshqa'
        items = []
        errors = []

        os.makedirs(output_dir, exist_ok=True)

        for row_num in sorted(rows.keys()):
            if row_num == 1:
                continue
            row = rows[row_num]
            code = (row.get(code_col) or '').strip()
            name = (row.get(name_col) or '').strip()
            if not code and not name:
                continue

            if name.startswith('◼'):
                cat = re.sub(r'^◼\s*', '', name).strip()
                if cat:
                    current_category = cat
                continue

            if not code or not name:
                errors.append({'row': row_num, 'message': 'Код yoki Номенклатура bo\'sh'})
                continue

            try:
                stock = int(float((row.get(stock_col) or '0').replace(',', '.')))
            except Exception:
                stock = 0

            try:
                price = float((row.get(price_col) or '0').replace(',', '.'))
            except Exception:
                errors.append({'row': row_num, 'code': code, 'message': 'Цена noto\'g\'ri'})
                continue

            if price <= 0:
                errors.append({'row': row_num, 'code': code, 'message': 'Цена noto\'g\'ri'})
                continue

            image_url = ''
            if row_num in row_images:
                file_name = safe_name(code) + '.png'
                file_path = os.path.join(output_dir, file_name)
                with open(file_path, 'wb') as f:
                    f.write(row_images[row_num])
                image_url = '/uploads/products/' + file_name

            items.append({
                'id': safe_name(code),
                'sku': code,
                'name': name,
                'category': current_category,
                'price': price,
                'oldPrice': price,
                'stock': stock,
                'image': image_url,
                'image_url': image_url,
            })

    print(json.dumps({'ok': True, 'items': items, 'errors': errors}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
