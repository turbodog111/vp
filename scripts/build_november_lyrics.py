"""Build cover-specific clocks and supplied Kuu ni Naru acoustic timelines."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from build_override import take, clean
from materialize_aligned_lyrics import group_words

ROOT = Path(__file__).resolve().parents[1]


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')


def retime(value, scale, offset, duration):
    if isinstance(value, list):
        return [retime(v, scale, offset, duration) for v in value]
    if isinstance(value, dict):
        return {k: max(0, min(duration, round(v*scale+offset, 5))) if k in ('start','end') and isinstance(v,(float,int))
            else retime(v, scale, offset, duration) for k,v in value.items()}
    return value


def build(evidence):
    import romkan2
    imports = {row['key']:row for row in json.loads((evidence/'imports.json').read_text())}
    clocks = json.loads((evidence/'cover-clocks.json').read_text())
    for key, original in [('override-fubuki','override'), ('magic-maid-okosama','magic-maid')]:
        row, clock = imports[key], clocks[key]
        data = retime(json.loads((ROOT/'songs/lyrics'/f'{original}.json').read_text()), clock['scale'], clock['offset'], row['duration'])
        data['duration'], data['artist'] = row['duration'], row['artist']
        if 'bpm' in data:
            data['bpm'] /= clock['scale']
        if 'beatOffset' in data:
            data['beatOffset'] = data['beatOffset']*clock['scale']+clock['offset']
        data['alignment'] = dict(recording=row['recording'],audioSha256=row['outputAudioSha256'],
            status='cover-clock-matched',approved=False,publicationAuthorizedBy='Joshua Glass',
            method='Copied source-song lyrics and theater; six multiband backing-track correlations determine recording offset and drift. Cover phonemes not independently forced-aligned.',
            originalTimeline=original+'.json',clock=clock)
        save(ROOT/'songs/lyrics'/f'{key}.json',data)
    source_path = ROOT/'songs/lyrics/sources/kuu-ni-naru.json'
    source = json.loads(source_path.read_text())
    for key in ('kuu-ni-naru','kuu-ni-naru-okosama'):
        row = imports[key]
        folder = evidence/key
        bounded = json.loads((folder/'bounded.json').read_text())
        roman = json.loads((folder/'romaji.json').read_text())
        flat = [w for s in bounded['segments'] for w in s['words']]
        roman_flat = [w for s in roman['segments'] for w in s['words']]
        lines = []
        for i,(jp,romaji,en) in enumerate(source['rows']):
            words = clean(take(flat,jp))
            display = romaji.split()
            kana = [romkan2.to_hiragana(w) for w in display]
            groups,_ = group_words(kana,take(roman_flat,''.join(kana)))
            at, timed = 0,[]
            for group in groups:
                n = len(group['text'].split())
                timed.append(dict(word=' '.join(display[at:at+n]),start=round(group['start'],3),end=round(group['end'],3)))
                at += n
            if at != len(display):
                raise ValueError('Romaji dropped')
            start,end = min(words[0]['start'],timed[0]['start']), max(words[-1]['end'],timed[-1]['end'])
            if lines and start < lines[-1]['end']:
                raise ValueError(f'{key} line {i+1} overlaps: {start} < {lines[-1]["end"]}')
            lines.append(dict(id=f'kuu-{i+1:02}',text=jp,jp=[jp],romaji=[romaji],en=[en],
                start=start,end=end,words=words,romajiWords=timed,enWords=[dict(word=en,start=start,end=end)]))
        if flat or roman_flat:
            raise ValueError('Acoustic tokens left over')
        boundaries = [0,lines[0]['start'],lines[8]['start'],lines[12]['start'],lines[15]['end'],
            lines[16]['start'],lines[20]['start'],lines[24]['start'],lines[28]['start'],lines[31]['end'],
            lines[32]['start'],lines[36]['start'],lines[-1]['end'],row['duration']]
        sections = [dict(start=a,end=b,phase=i,chorus=i in (3,7,8,10),name='WIND / '+str(i),short='KUU NI NARU')
            for i,(a,b) in enumerate(zip(boundaries,boundaries[1:])) if b>a]
        data = dict(song='Kuu ni Naru',artist=row['artist'],duration=row['duration'],language='ja',
            variants={'jp':dict(label='JAPANESE / ROMAJI / ENGLISH',lines=lines)},sections=sections,
            timingMethod='Independent recognition plus bounded phrase and kana-romaji forced alignment to this exact recording. Instrumental entrances were re-anchored rather than stretching text through gaps.',
            translationMethod='Japanese and romaji have measured acoustic token groups. English is phrase-level meaning translation, not sung English timing.',
            alignment=dict(recording=row['recording'],audioSha256=row['outputAudioSha256'],
                sourceSha256=hashlib.sha256(source_path.read_bytes()).hexdigest(),
                status='acoustically-aligned',approved=False,publicationAuthorizedBy='Joshua Glass'))
        save(ROOT/'songs/lyrics'/f'{key}.json',data)
        motion_path = ROOT/'songs/motion'/f'{key}.json'
        motion = json.loads(motion_path.read_text())
        motion['sections'] = sections
        save(motion_path,motion)
        print(key, len(lines),'lines',sum(len(l['words']) for l in lines),'Japanese tokens')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('evidence',type=Path)
    build(parser.parse_args().evidence)
