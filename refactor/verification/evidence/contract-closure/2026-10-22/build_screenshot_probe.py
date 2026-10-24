from pathlib import Path
import hashlib,json,os,shlex,shutil,subprocess
from probe_paths import ROOT, OUT, WORK
CACHE=ROOT/'node_modules/.cache/libmpv-design'
SOURCE=WORK/'mpv'
BUILD=WORK/'build'
MSYS=CACHE/'engine-build/msys64'
INPUT=json.loads((ROOT/'refactor/verification/evidence/libmpv-package/engine-input.json').read_text(encoding='utf-8'))
PREFIX=Path(INPUT['work'])/'prefix'
OPTIONS=['--buildtype=release','--wrap-mode=nodownload','--auto-features=disabled','-Dlibmpv=true','-Dcplayer=false','-Dbuild-date=false','-Dgpl=false','-Dlua=luajit','-Djavascript=enabled','-Dwin32-threads=enabled','-Dd3d11=enabled','-Dd3d-hwaccel=enabled','-Dwasapi=enabled','-Dshaderc=enabled','-Dspirv-cross=enabled','-Dgl=disabled','-Diconv=enabled','-Dzlib=enabled','-Dlcms2=enabled','-Dlibavdevice=enabled','-Dlibcurl=disabled']
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(args,**kwargs):return subprocess.run(args,check=True,creationflags=subprocess.CREATE_NO_WINDOW,**kwargs)
def posix(p):
    p=Path(p).resolve();return '/'+p.drive[0].lower()+p.as_posix()[2:]
def shell(args,name):
    bins=[PREFIX/'bin']+[Path(x['directory'])/('ucrt64/bin' if x['name'].startswith('mingw-') else 'usr/bin') for x in INPUT['inputs'] if x['kind']=='build-tool']
    path=':'.join(posix(p) for p in bins)+':/ucrt64/bin:/usr/bin:/c/Windows/System32'
    pkg=posix(PREFIX/'lib/pkgconfig')+':/ucrt64/lib/pkgconfig:/ucrt64/share/pkgconfig'
    command='\n'.join(['export PATH='+shlex.quote(path),'export PKG_CONFIG_PATH='+shlex.quote(pkg),'export PKG_CONFIG_LIBDIR='+shlex.quote(pkg),'cd '+shlex.quote(posix(WORK)),'exec '+shlex.join(args)])
    log=WORK/(name+'.log');print(name,flush=True)
    with log.open('w',encoding='utf-8') as stream:
        result=subprocess.run([str(MSYS/'usr/bin/bash.exe'),'--login','-c',command],env=dict(os.environ,MSYSTEM='UCRT64',CHERE_INVOKING='1'),cwd=WORK,stdout=stream,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        print('\n'.join(log.read_text(encoding='utf-8',errors='replace').splitlines()[-30:]));raise RuntimeError(name+' failed')
assert not SOURCE.exists(), 'Use the existing run explicitly instead of rebuilding it.'
run(['git','clone','--quiet','--no-hardlinks',str(CACHE/'engine-build/mpv-baseline'),str(SOURCE)])
assert subprocess.check_output(['git','-C',str(SOURCE),'rev-parse','HEAD'],text=True).strip()=='01e2533f3143b8940857ca419b0b367f583e05ca'
run(['git','-C',str(SOURCE),'apply',str(ROOT/'refactor/implementation/patches/libmpv/black-tone-map.patch')])
run(['git','-C',str(SOURCE),'apply',str(ROOT/'refactor/implementation/patches/libmpv/screenshot-source.patch')])
shell(['meson','setup',posix(BUILD),posix(SOURCE),*OPTIONS],'configure')
shell(['meson','compile','-C',posix(BUILD),'-j8'],'compile')
original=json.loads((ROOT/'refactor/verification/evidence/libmpv-package/engine-build.json').read_text(encoding='utf-8'))
runtime=WORK/'runtime';runtime.mkdir()
for p in Path(original['runtime']).iterdir():
    if p.is_file():shutil.copy2(p,runtime/p.name)
shutil.copy2(BUILD/'libmpv-2.dll',runtime/'libmpv-2.dll')
receipt={'scope':'isolated Windows x64 design probe; not a release','sourceCommit':'01e2533f3143b8940857ca419b0b367f583e05ca','patchSha256':sha(ROOT/'refactor/implementation/patches/libmpv/screenshot-source.patch'),'sourceSha256':sha(SOURCE/'player/screenshot.c'),'dll':str(runtime/'libmpv-2.dll'),'dllSha256':sha(runtime/'libmpv-2.dll'),'options':OPTIONS,'originalDependencyReceiptSha256':sha(ROOT/'refactor/verification/evidence/libmpv-package/engine-build.json')}
(OUT/'screenshot-build.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt),flush=True)
