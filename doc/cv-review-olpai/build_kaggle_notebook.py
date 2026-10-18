"""Package percent-style Python into a notebook and copyable Markdown cells."""
from pathlib import Path
import ast
import json

ROOT = Path(__file__).resolve().parent
source = (ROOT / 'kaggle_cv_short.py').read_text(encoding='utf-8')
ast.parse(source)
cells = []
for block in source.split('# %%')[1:]:
    markdown = block.startswith(' [markdown]')
    lines = block.splitlines()[1:]
    if markdown:
        lines = [line[2:] if line.startswith('# ') else line.removeprefix('#') for line in lines]
    text = '\n'.join(lines).strip() + '\n'
    if not markdown:
        compile(text, '<notebook-cell>', 'exec')
    cell = {'cell_type': 'markdown' if markdown else 'code', 'metadata': {},
            'source': text.splitlines(keepends=True)}
    if not markdown:
        cell.update(execution_count=None, outputs=[])
    cells.append(cell)

notebook = {
    'cells': cells,
    'metadata': {
        'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
        'language_info': {'name': 'python'},
        'kaggle': {'isInternetEnabled': False, 'isGpuEnabled': True,
                   'language': 'python', 'sourceType': 'notebook'},
    },
    'nbformat': 4, 'nbformat_minor': 4,
}
(ROOT / 'kaggle_cv_short.ipynb').write_text(
    json.dumps(notebook, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

parts = ['# Code từng cell cho Kaggle — GTSRB\n',
         'Đổi ROOT nếu đường dẫn Input khác. Bật GPU. Chạy lần lượt 11 cell.\n',
         'Lượt đầu Gamma=False; lượt sau mới bật Gamma. Các điểm cải thiện chưa được train xác nhận.\n']
for cell in cells:
    text = ''.join(cell['source'])
    if cell['cell_type'] == 'markdown':
        parts.append(text)
    else:
        title = text.splitlines()[0].removeprefix('# ')
        parts.append(f'## {title}\n\n```python\n{text}```\n')
(ROOT / 'KAGGLE_CELLS.md').write_text('\n'.join(parts), encoding='utf-8')
print(f'Created notebook and Markdown: {sum(c["cell_type"] == "code" for c in cells)} code cells.')
