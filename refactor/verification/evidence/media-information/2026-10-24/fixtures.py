import hashlib
import json
import subprocess
import wave
from pathlib import Path


def generate(directory: Path):
    """Generate small media with known fields; the encoder is used only for test inputs."""
    directory.mkdir(parents=True, exist_ok=True)
    captions = directory / 'captions.srt'
    captions.write_text('1\n00:00:00,000 --> 00:00:01,500\nSynthetic subtitle\n', encoding='utf-8')
    chapters = directory / 'chapters.txt'
    chapters.write_text(
        ';FFMETADATA1\ntitle=Synthetic media\n'
        '[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000\ntitle=First\n'
        '[CHAPTER]\nTIMEBASE=1/1000\nSTART=1000\nEND=2000\ntitle=Second\n',
        encoding='utf-8',
    )

    common = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24:duration=2',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
        '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=2',
        '-i', str(captions), '-i', str(chapters),
        '-map', '0:v', '-map', '1:a', '-map', '2:a', '-map', '3:s', '-map_metadata', '4', '-map_chapters', '4',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        '-metadata:s:a:0', 'language=jpn', '-metadata:s:a:1', 'language=eng',
        '-metadata:s:s:0', 'language=zho', '-t', '2',
    ]
    commands = []
    for filename, subtitle_codec in [('多轨道 🎬.mkv', 'srt'), ('multi-track.mp4', 'mov_text')]:
        command = [*common, '-c:s', subtitle_codec, str(directory / filename)]
        subprocess.run(command, check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
        commands.append(command)

    webm = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24:duration=2',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
        '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8',
        '-c:a', 'libopus', '-t', '2', str(directory / 'sample.webm'),
    ]
    subprocess.run(webm, check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    commands.append(webm)

    hevc = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=24:duration=2',
        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
        '-c:v', 'libx265', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p10le',
        '-x265-params', 'pools=none:frame-threads=1:log-level=error',
        '-c:a', 'flac', '-t', '2', str(directory / 'hevc-10bit.mkv'),
    ]
    subprocess.run(hevc, check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    commands.append(hevc)

    transport = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-i', str(directory / 'multi-track.mp4'), '-map', '0:v:0', '-map', '0:a:0',
        '-c', 'copy', '-f', 'mpegts', str(directory / 'sample.ts'),
    ]
    subprocess.run(transport, check=True, capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
    commands.append(transport)

    with wave.open(str(directory / 'silent.wav'), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(48000)
        output.writeframes(b'\0\0' * 96000)

    (directory / 'invalid.bin').write_bytes(b'not a media file\n' * 128)
    mp4_bytes = (directory / 'multi-track.mp4').read_bytes()
    (directory / 'truncated.mp4').write_bytes(mp4_bytes[:512])
    receipt = {
        'encoder': subprocess.check_output(['ffmpeg', '-version'], text=True).splitlines()[0],
        'commands': commands,
        'files': {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.iterdir()) if path.is_file()},
        'expected': {'videoWidth': 160, 'videoHeight': 90, 'seconds': 2, 'multiTrackCounts': {'video': 1, 'audio': 2, 'sub': 1}},
    }
    (directory / 'fixtures.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
    return receipt
