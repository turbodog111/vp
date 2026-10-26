"""Materialize the verified music-only Evil cover without publishing the raw clip."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess

from build_window_view_data import audio_analysis

ROOT = Path(__file__).resolve().parents[1]
NAME = 'Evil (Neuro-sama) - Encore Dance (Japanese).m4a'


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'stream=duration', '-select_streams', 'a:0', '-of', 'default=nw=1:nk=1', str(path)], text=True))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--start', type=float, default=5.89)
    parser.add_argument('--end', type=float, default=140.48)
    opts = parser.parse_args()
    source_duration = duration(opts.source)
    if not 0 <= opts.start < opts.end <= source_duration:
        raise ValueError('Cut outside source recording')
    destination = ROOT / 'songs' / NAME
    if destination.exists():
        raise FileExistsError('Preserve the existing music cut; select a new output for a new review')
    length = opts.end - opts.start
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(opts.source), '-vn',
        '-af', f'atrim=start={opts.start}:end={opts.end},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st={length-.02}:d=0.02',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
        '-metadata', 'title=Encore Dance (Japanese)', '-metadata', 'artist=Evil (Neuro-sama)',
        '-metadata', 'composer=MIMI', str(destination)], check=True)
    actual_duration = duration(destination)
    reference = json.loads((ROOT / 'songs/lyrics/encore-dance.json').read_text())
    analysis = dict(audio_analysis(destination), bpm=132, beatOffset=.275, encoding='base64-u8-0-100')
    data = {'song': 'Encore Dance', 'duration': actual_duration,
        'credits': {'original': 'MIMI feat. Kasane Teto SV', 'musicLyrics': 'MIMI',
            'coverPerformance': 'Evil (Neuro-sama)', 'clipUploader': 'Neuro Sama Clipper'},
        'timing': {'base': 'jp', 'sourceOffset': opts.start,
            'method': 'Six independent multi-band backing-track correlations at 0-132s agree on a 5.89s source offset (within 0.01s); no global tempo drift. Japanese lyric cues follow the existing source-song timeline; cover vocals remain a listening-review candidate.'},
        'sections': [dict(section, end=min(section['end'], actual_duration))
            for section in reference['sections'] if section['start'] < actual_duration],
        'variants': {'jp': dict(copy.deepcopy(reference['variants']['jp']), label='EVIL / NEURO-SAMA')},
        'analysis': {'jp': analysis},
        'alignment': {'recording': 'songs/' + NAME, 'audioSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
            'status': 'local-review', 'approved': False,
            'method': 'Matched accompaniment clock; reused existing Japanese song cues, not a claim of independently measured cover phonemes.'}}
    (ROOT / 'songs/lyrics/encore-dance-evil.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    provenance = {'recording': 'songs/' + NAME, 'source': 'https://www.youtube.com/watch?v=-KrxHwn6BSw',
        'sourceTitle': 'Evil sings Encore Dance by MIMI', 'uploader': 'Neuro Sama Clipper',
        'performer': 'Evil (Neuro-sama)', 'originalMusicLyrics': 'MIMI',
        'sourceAudioSha256': hashlib.sha256(opts.source.read_bytes()).hexdigest(),
        'sourceDuration': source_duration, 'trimStart': opts.start, 'trimEnd': opts.end,
        'outputDuration': actual_duration, 'outputAudioSha256': data['alignment']['audioSha256'],
        'edgeTreatment': '6ms entrance and 20ms tail fade; no normalization or tempo change.',
        'evidence': 'Backing-track correlations: reference 0s/15s/35s/60s/100s/125s match source offsets 5.89/5.89/5.89/5.88/5.89/5.89s. Intro speech at 3.82-4.58s excluded. Ending signal decays below -79dB by 140.4s; cut before non-musical signal after 140.8s.'}
    folder = ROOT / 'songs/imports'
    folder.mkdir(exist_ok=True)
    (folder/'encore-dance-evil.json').write_text(json.dumps(provenance, indent=2)+'\n')
    manifest_file = ROOT / 'songs/manifest.json'
    manifest = json.loads(manifest_file.read_text())
    if any(item['name'].casefold() == NAME.casefold() for item in manifest):
        raise ValueError('Duplicate catalog recording')
    manifest.append({'name': NAME, 'size': destination.stat().st_size, 'type': 'file'})
    manifest.sort(key=lambda item: item['name'].casefold())
    manifest_file.write_text(json.dumps(manifest, indent=2)+'\n')
    print(json.dumps({'file': str(destination), 'duration': actual_duration, 'bytes': destination.stat().st_size,
        'trim': [opts.start, opts.end]}, indent=2))


if __name__ == '__main__':
    main()
