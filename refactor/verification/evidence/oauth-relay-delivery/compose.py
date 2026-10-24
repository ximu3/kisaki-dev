"""Render the real Compose configuration with owned, non-secret runtime values."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
inputs = json.loads((HERE/'source-input.json').read_text(encoding='utf-8'))
assert h(inputs['compose']['path']) == inputs['compose']['archive']['sha256']
work = Path(tempfile.mkdtemp(prefix='compose inputs-', dir=inputs['work']))
config = work/'config.json'
shutil.copy2(HERE.parents[2]/'design/projects/oauth-relay/config.example.json', config)
runtime = work/'credentials.env'
shutil.copy2(HERE/'runtime.example.env', runtime)
docker_config = work/'docker-config'
docker_config.mkdir()
(docker_config/'config.json').write_text('{"auths":{}}\n',encoding='utf-8')
project_env = work/'project.env'
image = 'registry.example.invalid/oauth-relay@sha256:'+'1'*64
project_env.write_text(f'RELAY_IMAGE={image}\nRELAY_CONFIG_FILE="{config.as_posix()}"\n'
                       f'RELAY_ENV_FILE="{runtime.as_posix()}"\nRELAY_HOST_PORT=33000\nRELAY_BIND_ADDRESS=127.0.0.1\n',encoding='utf-8')
environment = {key:value for key,value in os.environ.items() if not key.startswith('RELAY_')}
environment.update({'DOCKER_CONFIG':str(docker_config), 'DOCKER_HOST':'npipe:////./pipe/oauth-relay-design-no-daemon',
                    'RELAY_DESIGN_SENTINEL':'expanded-owned-sentinel'})
arguments = [inputs['compose']['path'], '--project-directory', str(work), '--env-file', str(project_env)]

def render(path):
    result = subprocess.run([*arguments, '-f', str(path), 'config', '--format', 'json'], cwd=work,
                            env=environment,capture_output=True,text=True,timeout=30,creationflags=subprocess.CREATE_NO_WINDOW)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout), result.stderr

model, diagnostics = render(HERE/'compose.yaml')
assert list(model['services']) == ['relay']
service = model['services']['relay']
expected = {line.split('=',1)[0]:line.split('=',1)[1] for line in runtime.read_text(encoding='utf-8').splitlines()
            if line and not line.startswith('#')}
# The CLI serializes dollar signs as $$ so the rendered config can be loaded again.
canonical = lambda value: value.replace('$', '$$')
assert all(service['environment'][key] == canonical(value) for key,value in expected.items())
assert service['environment']['RELAY_CONFIG'] == '/etc/oauth-relay/config.json'
assert service['image'] == image and 'build' not in service
assert service['stop_grace_period'] == '30s'
assert service['restart'] == 'unless-stopped'
assert service['ports'][0]['target'] == 3000 and service['ports'][0]['published'] == '33000'
assert service['ports'][0]['host_ip'] == '127.0.0.1'
assert service['volumes'][0]['read_only'] and service['volumes'][0]['bind']['create_host_path'] is False
assert Path(service['volumes'][0]['source']).samefile(config)
assert service['healthcheck']['test'][:3] == ['CMD','node','-e']
plain = work/'plain-control.yaml'
source = (HERE/'compose.yaml').read_text(encoding='utf-8')
assert source.count('        format: raw\n') == 1
plain.write_text(source.replace('        format: raw\n',''),encoding='utf-8')
control, control_diagnostics = render(plain)
changed = [key for key,value in expected.items() if control['services']['relay']['environment'][key] != canonical(value)]
assert changed
version = subprocess.run([inputs['compose']['path'],'version','--short'],capture_output=True,text=True,
                         timeout=10,creationflags=subprocess.CREATE_NO_WINDOW)
assert version.returncode == 0
receipt = {'checkedAt':datetime.now(timezone.utc).isoformat(), 'composeVersion':version.stdout.strip(),
           'literalRuntimeValuesPreserved':True, 'defaultParserChangedFields':changed,
           'renderedDollarEscapingAccountedFor':True,
           'serviceCount':1, 'imageIsOwnedPlaceholder':True, 'configurationMountReadOnly':True,
           'configurationMountDoesNotCreateHostPath':True, 'hostLoopbackBinding':True,
           'stopGracePeriod':service['stop_grace_period'], 'healthcheck':service['healthcheck'],
           'work':str(work), 'diagnostics':diagnostics, 'controlDiagnostics':control_diagnostics,
           'sourceReceiptSha256':h(HERE/'source-input.json'),
           'sources':{name:h(HERE/name) for name in ['compose.yaml','.env.example','runtime.example.env','compose.py']},
           'dockerEngineUsed':False, 'containerStarted':False, 'imageBuilt':False, 'realCredentialsUsed':False,
           'composeConfigExpandedIntoPublicEvidence':False}
(HERE/'compose-contract.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'version':receipt['composeVersion'],'literalValuesPreserved':True,'controlChangedFields':len(changed)}))
