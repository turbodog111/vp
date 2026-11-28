"""Pack the pinned AxiDraw single-line fonts for Canvas (no font engine at runtime).

Input directory: fonts/EMS from https://gitlab.com/oskay/svg-fonts at
8c71f2d9e1a5292047bb88e5595a766241b82cc6. See fonts/pen-OFL.txt.
"""
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS = [
    ("letter", "EMSAllure.svg", 340, "d9ef1032a2059d3b90189b9cacc26124812962503d6e7bdfe8b09b09904ce379"),
    ("print", "EMSCasualHand.svg", 585, "e8c64afb9739ff78b3cd0ae1bfb95d21fb1077eda569e0eef5d262b64da38041"),
]


def pack(path, height, checksum):
    assert hashlib.sha256(path.read_bytes()).hexdigest() == checksum
    result = {}
    for glyph in ET.parse(path).findall(".//{*}glyph"):
        char = glyph.get("unicode", "")
        if len(char) != 1 or not (32 <= ord(char) <= 126):
            continue
        entry = [round(float(glyph.get("horiz-adv-x"))*32/height)]
        tokens = iter(glyph.get("d", "").split())
        for command in tokens:
            if command == "M":
                entry.append([])
            elif command != "L":
                raise ValueError(f"Unexpected stroke command {command} in {char}")
            x, y = round(float(next(tokens))*32/height), -round(float(next(tokens))*32/height)
            if entry[-1][-2:] != [x, y]:
                entry[-1].extend((x, y))
        result[char] = entry
    return result


if __name__ == "__main__":
    fonts = {name: pack(Path(sys.argv[1])/file, height, sha) for name, file, height, sha in FONTS}
    body = json.dumps(fonts, separators=(",", ":"))
    (ROOT / "reality-letterforms.js").write_text(
        "// Plotter glyph data, SIL OFL 1.1. See fonts/pen-OFL.txt and scripts/build_reality_letterforms.py.\n"
        "(function (root) {\n  const forms = "+body+";\n"
        "  if (typeof module === 'object' && module.exports) module.exports = forms;\n"
        "  else root.RealityLetterforms = forms;\n})(globalThis);\n"
    )
