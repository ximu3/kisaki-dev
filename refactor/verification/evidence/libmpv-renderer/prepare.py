"""Prepare a pinned upstream CI artifact for an isolated renderer comparison."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT/'node_modules/.cache/libmpv-design/renderer-upstream'
HEAD = '16563d120f3260cdc0beb1b07f199818fc32dd8c'
ARTIFACT = 11826903959
DIGEST = 'e03e03127feef3efd910d55b44457cc59b3cff3890a8f4e6a4cf60d48e9e9090'


def request_json(url):
    request = urllib.request.Request(url, headers={'User-Agent':'Kisaki-design-verification'})
    with urllib.request.urlopen(request,timeout=25) as response:
        return json.load(response)


CACHE.mkdir(parents=True,exist_ok=True)
artifact = request_json(f'https://api.github.com/repos/mpv-player/mpv/actions/artifacts/{ARTIFACT}')
pull_request = request_json('https://api.github.com/repos/mpv-player/mpv/pulls/18607')
assert artifact['digest'] == f'sha256:{DIGEST}'
assert artifact['workflow_run']['head_sha'] == HEAD
merge = request_json('https://api.github.com/repos/mpv-player/mpv/commits/69f6399d1')
assert HEAD in [parent['sha'] for parent in merge['parents']]
archive = CACHE/'pr18607-lgpl-x64.zip'
source = f'https://nightly.link/mpv-player/mpv/actions/artifacts/{ARTIFACT}.zip'
if not archive.is_file():
    with urllib.request.urlopen(source,timeout=45) as response, archive.open('wb') as output:
        while block:=response.read(1024*1024):
            output.write(block)
assert hashlib.sha256(archive.read_bytes()).hexdigest() == DIGEST
directory = CACHE/'pr18607-binary'
with zipfile.ZipFile(archive) as package:
    for entry in package.infolist():
        assert (directory/entry.filename).resolve().is_relative_to(directory.resolve())
    package.extractall(directory)
dll = directory/'libmpv-2.dll'
receipt = {'checkedAt':datetime.now(timezone.utc).isoformat(),
           'pullRequest':'https://github.com/mpv-player/mpv/pull/18607',
           'pullRequestHead':HEAD,'testedMergeCommit':merge['sha'],
           'pullRequestState':pull_request['state'],'pullRequestMerged':pull_request['merged'],
           'currentPullRequestHead':pull_request['head']['sha'],
           'workflowRun':artifact['workflow_run']['id'],'artifactId':ARTIFACT,
           'artifactName':artifact['name'],'source':source,'archiveSha256':DIGEST,
           'dll':str(dll.resolve()),'dllSha256':hashlib.sha256(dll.read_bytes()).hexdigest(),
           'artifactLicenseLabel':'lgpl','selectedForRelease':False,
           'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(HERE/'binary-input.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'artifactId':ARTIFACT,'testedMergeCommit':merge['sha'],'verifiedArchive':True}))
