"""Materialize the supplied lyrics from external acoustic evidence, never ASR text."""
import argparse
import hashlib
import json
from pathlib import Path

from materialize_aligned_lyrics import canonical, group_words

ROOT = Path(__file__).resolve().parents[1]
RECORDING = 'songs/Yoshida Yasei feat. Kasane Teto SV - Override.m4a'


def take(flat, text):
    target, content, words = canonical(text), '', []
    while len(content) < len(target) and flat:
        word = flat.pop(0)
        content += canonical(word['word'])
        words.append(word)
    if content != target:
        raise ValueError('Acoustic tokens differ from supplied lyric: ' + text)
    return words


def clean(words):
    groups, _ = group_words([w['word'].strip() for w in words if w['word'].strip()], words)
    return [dict(word=w['text'], start=round(w['start'], 3), end=round(w['end'], 3)) for w in groups]


def build(evidence):
    import romkan2
    source_path = ROOT / 'songs/lyrics/sources/override.json'
    source = json.loads(source_path.read_text())
    bounded = json.loads((evidence / 'bounded.json').read_text())
    roman = json.loads((evidence / 'romaji.json').read_text())
    flat = [w for s in bounded['segments'] for w in s['words']]
    roman_flat = [w for s in roman['segments'] for w in s['words']]
    motion = json.loads((ROOT / 'songs/motion/override.json').read_text())
    lines, review = [], []
    for i, (jp, romaji, en) in enumerate(source['rows']):
        words = clean(take(flat, jp))
        display = romaji.split()
        kana = [romkan2.to_hiragana(w) for w in display]
        aligned_roman = take(roman_flat, ''.join(kana))
        groups, _ = group_words(kana, aligned_roman)
        timed_roman, cursor = [], 0
        for group in groups:
            count = len(group['text'].split())
            timed_roman.append(dict(word=' '.join(display[cursor:cursor+count]),
                start=round(group['start'], 3), end=round(group['end'], 3)))
            cursor += count
        if cursor != len(display):
            raise ValueError('Missing romaji at row ' + str(i + 1))
        start = min(words[0]['start'], timed_roman[0]['start'])
        end = max(words[-1]['end'], timed_roman[-1]['end'])
        line = dict(id=f'override-{i+1:02}', text=jp, jp=[jp], romaji=[romaji], en=[en],
            start=start, end=end, words=words, romajiWords=timed_roman,
            enWords=[dict(word=en, start=start, end=end)])
        if lines and start < lines[-1]['end']:
            raise ValueError(f'Crossed phrase boundaries at row {i+1}: {start} < {lines[-1]["end"]}')
        lines.append(line)
        review.append({'line': i+1, 'start': start, 'end': end,
            'longTokens': [w for w in words if w['end']-w['start'] > 1.4]})
    if flat or roman_flat:
        raise ValueError('Unconsumed acoustic tokens')
    sections = [
        (0, 12.1, 'overture', False), (12.1, 31.3, 'badlands', False),
        (31.3, 40, 'crossroads', False), (40, 59.7, 'override', True),
        (59.7, 68, 'reversal', False), (68, 85.2, 'lottery', False),
        (85.2, 89.45, 'escape', False), (89.45, 108.9, 'rewrite', True),
        (108.9, 117.9, 'reversal', False), (117.9, 127.8, 'code', False),
        (127.8, motion['duration'], 'coda', False)]
    audio = ROOT / RECORDING
    data = dict(song='Override', artist='Yoshida Yasei feat. Kasane Teto SV',
        duration=motion['duration'], language='ja',
        source='Japanese supplied by Joshua Glass; original composition and lyrics by Yoshida Yasei.',
        timingMethod='Cached Whisper large-v3-turbo: whole-recording alignment checked against independent recognition, then bounded Japanese and kana-pronunciation romaji alignment. Not uniform text-length timing.',
        translationMethod='English is a meaning translation at phrase level, not sung English. Japanese and romaji use acoustic token groups; inseparable syllables remain grouped.',
        translationNotes=['Shitai in the second chorus can suggest both wanting to do something and a corpse; the translation keeps the desire reading.'],
        variants={'jp': {'label': 'JAPANESE / ROMAJI / ENGLISH', 'lines': lines}},
        sections=[dict(start=a, end=b, key=k, label=k.upper(), chorus=c) for a, b, k, c in sections],
        alignment={'recording': RECORDING, 'audioSha256': motion['audioSha256'],
            'sourceSha256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
            'status': 'acoustically-aligned', 'approved': False,
            'publicationAuthorizedBy': 'Joshua Glass', 'publicationAuthorizationDate': '2026-10-26',
            'review': 'Technical alignment checked; no claim of user listening approval or sample-perfect phoneme boundaries.'})
    (ROOT / 'songs/lyrics/override.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    metadata = json.loads((evidence / 'source.info.json').read_text())
    provenance = dict(recording=RECORDING, source='https://www.youtube.com/watch?v=LLjfal8jCYI',
        sourceTitle=metadata['title'], artist='Yoshida Yasei feat. Kasane Teto SV',
        musicLyrics='Yoshida Yasei', sourceIllustration='シシア',
        sourceAudioSha256=hashlib.sha256((evidence/'source.webm').read_bytes()).hexdigest(),
        outputAudioSha256=motion['audioSha256'], duration=motion['duration'],
        encoding='AAC 192k, 48kHz stereo, faststart; complete song, no tempo or gain manipulation',
        bpm=motion['bpm'], beatOffset=motion['beatOffset'])
    (ROOT/'songs/imports/override.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n')
    manifest_path = ROOT / 'songs/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    name = audio.name
    matches = [row for row in manifest if row['name'] == name]
    if len(matches) > 1:
        raise ValueError('Duplicate recording')
    if matches:
        matches[0]['size'] = audio.stat().st_size
    else:
        manifest.append(dict(name=name, size=audio.stat().st_size, type='file'))
    manifest.sort(key=lambda row: row['name'].casefold())
    manifest_path.write_text(json.dumps(manifest, indent=2)+'\n')
    (evidence/'timing-review.json').write_text(json.dumps(review, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'lines': len(lines), 'JapaneseTokens': sum(len(l['words']) for l in lines),
        'romajiTokens': sum(len(l['romajiWords']) for l in lines), 'duration': motion['duration']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('evidence', type=Path)
    build(parser.parse_args().evidence)
