"""Import the five requested recordings without publishing raw extractor metadata."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TRACKS = (
    ('f6TytcA47rI', 'kuu-ni-naru', 'MIMI feat. Hatsune Miku & KAFU', 'Kuu ni Naru', 'MIMI', False),
    ('emSnkwlzfls', 'kuu-ni-naru-okosama', 'Okosama Lunch', 'Kuu ni Naru', 'MIMI', False),
    ('mLMASFdWYng', 'override-fubuki', 'Shirakami Fubuki feat. Kurokami Fubuki', 'Override', 'Yoshida Yasei', False),
    ('WGG24fmA86c', 'magic-maid-okosama', 'Okosama Lunch', 'Magic Maid', 'MIMI', False),
    ('XKuuIuYiqHU', 'peace-on-earth', 'Phil Wickham & CeCe Winans', 'Peace on Earth', None, True),
)


def probe(file):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration,size:stream=codec_name,sample_rate,channels', '-of', 'json', str(file)], text=True))


def main(evidence):
    catalogs = {}
    output = []
    for video, key, artist, title, composer, christian in TRACKS:
        folder = ROOT / 'songs' / ('christian' if christian else '')
        name = f'{artist} - {title}.m4a'
        file = folder / name
        source = evidence / (video + '.webm')
        info = json.loads((evidence / (video + '.info.json')).read_text())
        if not file.exists():
            args = ['ffmpeg', '-v', 'error', '-i', str(source), '-vn', '-c:a', 'aac', '-b:a', '192k',
                '-ar', '48000', '-movflags', '+faststart', '-metadata', 'title='+title, '-metadata', 'artist='+artist]
            if composer:
                args += ['-metadata', 'composer='+composer]
            subprocess.run(args + [str(file)], check=True)
        measured = probe(file)
        duration = float(measured['format']['duration'])
        if abs(duration - float(probe(source)['format']['duration'])) > .1:
            raise ValueError('Source/output duration mismatch')
        subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(file), '-f', 'null', '-'], check=True)
        catalog_path = folder / 'manifest.json'
        catalog = catalogs.setdefault(catalog_path, json.loads(catalog_path.read_text()))
        matches = [row for row in catalog if row['name'].casefold() == name.casefold()]
        if matches:
            raise ValueError('Already in catalog; do not import duplicates: '+name)
        catalog.append(dict(name=name, size=file.stat().st_size, type='file'))
        record = dict(recording=str(file.relative_to(ROOT)), title=title, artist=artist,
            source='https://www.youtube.com/watch?v='+video, sourceTitle=info['title'], sourceUploader=info['channel'],
            duration=duration, encoding='AAC 192k / 48kHz stereo / faststart; full recording, no tempo or gain editing',
            sourceAudioSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            outputAudioSha256=hashlib.sha256(file.read_bytes()).hexdigest(), importDate='2026-11-06')
        if composer:
            record['originalMusicLyrics'] = composer
        if artist == 'Okosama Lunch':
            record['performerOriginalName'] = 'おこさまランチ'
        if key == 'override-fubuki':
            record['performanceNote'] = 'Source credits Shirakami Fubuki with one phrase by Kurokami Fubuki.'
        (ROOT/'songs/imports'/f'{key}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n')
        output.append(dict(key=key, **record))
    for file, catalog in catalogs.items():
        catalog.sort(key=lambda row: row['name'].casefold())
        file.write_text(json.dumps(catalog, indent=2)+'\n')
    (evidence/'imports.json').write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps([{k:row[k] for k in ['key','recording','duration']} for row in output], indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('evidence', type=Path)
    main(parser.parse_args().evidence)
