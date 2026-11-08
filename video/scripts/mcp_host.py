"""Run the unchanged real MCP server; open owner URLs over stdin, never argv."""
from pathlib import Path
import runpy
import subprocess
import webbrowser

ROOT = Path(__file__).resolve().parents[1]


def local_browser(url, *args, **kwargs):
    result = subprocess.run(['node', str(ROOT / 'scripts/open-owner.mjs')],
        input=url.encode(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        cwd=ROOT, timeout=45)
    return result.returncode == 0


webbrowser.open = local_browser
runpy.run_path(str(ROOT.parent / 'scripts/spendconsent_mcp.py'), run_name='__main__')
