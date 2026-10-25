"""Explicit inventory first; copy only reviewed, hash-pinned files to the isolated report worktree."""
import argparse
import hashlib
import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAN = Path(__file__).resolve().parent / 'PUBLICATION_PLAN.json'
DESTINATION = Path('C:/Users/sb128/.codex/worktrees/workbench-v22-final-acceptance-report/LearningPlatform/acceptance/v22/snapshots/2026-10-25-final-07efb7f8')
APPROVED_DIRECTORIES = {
    'application-captures-01', 'application-captures-02', 'application-captures-03',
    'authored-pane-retention-03', 'authored-pane-retention-04',
    'authoring-01', 'authoring-continuation-02', 'authoring-continuation-bundle',
    'curated-activation-02', 'default-captures-02', 'final-bundle', 'integration',
    'independent-audit', 'intervention-prepare-01', 'journey-bundle',
    'legacy-outcomes-01', 'legacy-outcomes-02', 'outcomes-bundle', 'original-result-01',
    'navigation-supplement-01', 'six-blockers-01', 'v09-private-01', 'shell-accessibility-01',
    'intervention-prepare-02', 'intervention-browser-01', 'intervention-reconciled-01',
    'intervention-followup-evaluation-01', 'intervention-followup-browser-01',
    'journey-persistence-01', 'journey-persistence-reconciled-01', 'shell-accessibility-02',
    'prototype-captures-01', 'prototype-objectives-02', 'student-bundle',
    'student-core-01', 'student-results-01', 'student-recovery-01', 'student-seed-01',
    'study-evaluation-01', 'study-reconciled-01', 'study-step-01', 'study-step-02',
    'teacher-recovery-01', 'teacher-recovery-02', 'visual-bundle',
}
SUFFIXES = {'.json','.png','.jpg','.jpeg','.log','.txt','.md','.mjs','.cjs','.js','.py','.ps1','.html','.css'}
PRUNE = re.compile(r'(^node_modules$|^\.git$|^objects$|profile|user-data|browser-data|reconciled-owned-lock|^Default$|^Cache$|^Code Cache$|^GPUCache$|^vendor$)',re.I)
PRIVATE_NAMES = re.compile(r'(^\.env|^compose\.(json|ya?ml)$|^manifest\.json$|storage[-_.]?state|^cookies?\.|^preferences$|^local state$|^login data$|^web data$|^owner\.json$)',re.I)
SENSITIVE_KEYS = re.compile(r'^(password|password_hash|passwordHash|cookie|cookies|set-cookie|authorization|access_token|refresh_token|sessionToken|session_token|review_token|auth_secret|database_url|pgpassword|openai_api_key|storageState|localStorage|sessionStorage|credentials)$',re.I)
TEXT_CREDENTIAL = re.compile(r'"(password|password_hash|passwordHash|cookie|set-cookie|authorization|access_token|refresh_token|sessionToken|session_token|review_token|auth_secret|database_url|pgpassword|openai_api_key)"\s*:\s*"([^"\r\n]+)"',re.I)
HASH = lambda data: hashlib.sha256(data).hexdigest()
PRIVATE_SNAPSHOTS = {
    'journey-persistence-01/04-before.log', 'journey-persistence-01/before.json',
    'journey-persistence-reconciled-01/04-after-read-only-snapshot.log',
    'journey-persistence-reconciled-01/after.json',
}

def secrets():
    result=[]
    for envfile in ROOT.glob('runtime*/.env.acceptance'):
        for line in envfile.read_text(encoding='utf-8-sig').splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            key,value=line.split('=',1)
            value=value.strip().strip('"\'')
            if re.search(r'PASSWORD|SECRET|TOKEN|API_KEY',key,re.I) and len(value)>=8:
                result.append((key,value))
    return result

def findings(value,path='$'):
    result=[]
    if isinstance(value,dict):
        for key,child in value.items():
            here=f'{path}.{key}'
            if SENSITIVE_KEYS.fullmatch(key) and child not in (None,'',[],{}):
                result.append(here)
            result.extend(findings(child,here))
    elif isinstance(value,list):
        for index,child in enumerate(value):
            result.extend(findings(child,f'{path}[{index}]'))
    return result

def evidence_credentials(paths):
    # Snapshot logs may carry review tokens which are not environment secrets.
    # Keep values only in memory; the plan records field names, never values.
    result=[]
    for path in paths:
        if path.suffix.lower() not in ('.json','.log','.txt'): continue
        text=path.read_bytes().decode('utf-8-sig',errors='replace').replace('\\"','"')
        for match in TEXT_CREDENTIAL.finditer(text):
            name,value=match.groups()
            if len(value)>=8: result.append(('evidence:'+name,value))
    return result

def remove_guard_tokens(value,path='$'):
    changed=[]
    if isinstance(value,dict):
        # Only guard ownership metadata is transformed. Record IDs stay intact.
        for key in ('lockOwner','lock_owner','lock'):
            if isinstance(value.get(key),dict) and 'token' in value[key]:
                del value[key]['token']
                changed.append(f'{path}.{key}.token')
        owner=value.get('owner')
        if isinstance(owner,dict) and 'token' in owner and any(key in owner for key in ('project','sourceSha','source','mode','action')):
            del owner['token']
            changed.append(f'{path}.owner.token')
        for key,child in value.items():
            changed.extend(remove_guard_tokens(child,f'{path}.{key}'))
    elif isinstance(value,list):
        for index,child in enumerate(value):
            changed.extend(remove_guard_tokens(child,f'{path}[{index}]'))
    return changed

def walk_selected(folder):
    if not folder.exists():
        return
    for base,dirs,files in os.walk(folder):
        dirs[:]=[d for d in dirs if not PRUNE.search(d) and not (Path(base)/d).is_symlink()]
        for name in files:
            path=Path(base)/name
            if not path.is_symlink() and path.suffix.lower() in SUFFIXES:
                yield path

def selected(extra):
    paths=set()
    for folder in sorted(APPROVED_DIRECTORIES|set(extra)):
        if not re.fullmatch('[a-z0-9][a-z0-9-]*',folder) or folder.startswith('runtime') or PRUNE.search(folder):
            raise ValueError('Unsafe extra directory name')
        paths.update(walk_selected(ROOT/folder))
    for runtime in ('runtime-final','runtime-initial-port-conflict','runtime-initial-port-conflict-2'):
        paths.update(walk_selected(ROOT/runtime/'runs'))
        manifest=ROOT/runtime/'manifest.json'
        if manifest.exists(): paths.add(manifest)
    for path in ROOT.iterdir():
        if path.is_file() and (path.name.endswith('.guard.json') or path.suffix=='.md' or path.name in ('provisional-visual-image-inventory.json','prototype-aggregate-03.json','application-aggregate-04.json','FINAL_VISUAL_GALLERY.html')):
            paths.add(path)
    paths.update((ROOT/'report-drafts').glob('*.md'))
    paths.add(Path(__file__).resolve())
    return sorted(paths)

def derive(entry):
    path=(ROOT/entry['source']).resolve()
    if not path.is_relative_to(ROOT.resolve()): raise ValueError('Escaping source')
    raw=path.read_bytes()
    if HASH(raw)!=entry['source_sha256']:
        raise ValueError('Source changed after inventory: '+entry['source'])
    if entry['transformation']=='none': return raw
    obj=json.loads(raw.decode('utf-8-sig'))
    if entry['transformation']=='manifest-summary':
        obj={key:obj[key] for key in entry['manifest_keys'] if key in obj}
    elif entry['transformation']=='remove-guard-tokens':
        remove_guard_tokens(obj)
    else: raise ValueError('Unknown transformation')
    return (json.dumps(obj,indent=2,ensure_ascii=False)+'\n').encode()

def inventory(extra):
    paths=selected(extra)
    known=secrets()+evidence_credentials(paths)
    entries=[]
    for path in paths:
        rel=path.relative_to(ROOT).as_posix()
        raw=path.read_bytes()
        entry={'source':rel,'source_sha256':HASH(raw),'source_bytes':len(raw),'decision':'include','transformation':'none','destination':rel}
        if rel=='FINAL_VISUAL_GALLERY.html': entry['destination']='comparison-gallery.html'
        if rel.startswith('report-drafts/'):
            entry['destination']=path.name if path.suffix=='.md' else 'publication/'+path.name
        if rel in PRIVATE_SNAPSHOTS:
            entry['decision']='exclude-full-database-snapshot-retain-private-original'
        if PRIVATE_NAMES.search(path.name):
            if path.name=='manifest.json' and rel.startswith('runtime'):
                obj=json.loads(raw.decode('utf-8-sig'))
                entry['transformation']='manifest-summary'
                entry['destination']=rel.replace('manifest.json','manifest.sanitized.json')
                entry['manifest_keys']=[key for key in obj if key not in ('secrets','environment','env','credentials')]
            else:
                entry['decision']='exclude-private'
        if path.suffix.lower() not in ('.png','.jpg','.jpeg'):
            txt=raw.decode('utf-8-sig',errors='replace')
            matches=sorted({key for key,value in known if value in txt})
            if matches:
                entry['decision']='exclude-known-credential'
                entry['credential_names_only']=matches
            if path.suffix.lower() in ('.log','.txt'):
                fields=sorted({m.group(1) for m in TEXT_CREDENTIAL.finditer(txt.replace('\\"','"'))})
                if fields:
                    entry['decision']='exclude-sensitive-snapshot-log'
                    entry['sensitive_field_names_only']=fields
            if path.suffix=='.json':
                try:
                    obj=json.loads(txt)
                    sensitive=findings(obj)
                    if sensitive:
                        entry['decision']='exclude-sensitive-json'
                        entry['sensitive_paths']=sensitive
                    removed=remove_guard_tokens(obj)
                    if removed and entry['decision']=='include':
                        entry['transformation']='remove-guard-tokens'
                        entry['removed_json_paths']=removed
                        entry['destination']=entry['destination'][:-5]+'.sanitized.json'
                except ValueError:
                    entry['decision']='exclude-invalid-json-manual-review'
        if entry['decision']=='include':
            derived=derive(entry)
            # Recheck the exact transformed publication bytes.
            if path.suffix.lower() not in ('.png','.jpg','.jpeg') and any(value in derived.decode('utf-8',errors='replace') for _,value in known):
                raise ValueError('Credential detected in derived artifact: '+rel)
            entry['published_sha256']=HASH(derived)
            entry['published_bytes']=len(derived)
        entries.append(entry)
    destinations=[x['destination'] for x in entries if x['decision']=='include']
    if len(destinations)!=len(set(destinations)): raise ValueError('Duplicate destination in explicit allowlist')
    plan={'schemaVersion':1,'prepared_at':datetime.now(timezone.utc).isoformat(),'application_sha':'07efb7f821339538800f150f57b298eb2e606be3','application_tree':'948b9a6005a056c97f10d181c589b5352d6221f3','source_root':str(ROOT),'destination':str(DESTINATION),'mode':'inventory-only-no-copy','explicit_extra_directories':extra,'excluded_by_selection':['.env files and compose configurations','browser profiles/cookies/storage state','raw manifests (only reviewed summary derivatives selected)','guard owner/lock directories','independent Git objects and all .git/node_modules directories','prototype vendor runtime/export archive','all directories not explicitly selected'],'limitations':['Pixel inspection of screenshots remains required','Bounded known-secret and sensitive-key scan does not prove arbitrary text contains no secret','Files added or changed after this inventory are not copied; regenerate and inspect the plan','Raw originals are retained privately; sanitized derivatives have distinct filenames'],'files':entries}
    PLAN.write_text(json.dumps(plan,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'plan':str(PLAN),'included':sum(x['decision']=='include' for x in entries),'excluded':[{'path':x['source'],'reason':x['decision']} for x in entries if x['decision']!='include'],'sanitized':[x['destination'] for x in entries if x['decision']=='include' and x['transformation']!='none'],'bytes':sum(x.get('published_bytes',0) for x in entries)},indent=2))

def copy():
    plan=json.loads(PLAN.read_text(encoding='utf-8'))
    if Path(plan['destination']).resolve()!=DESTINATION.resolve(): raise ValueError('Destination mismatch')
    if DESTINATION.exists(): raise ValueError('Snapshot already exists; never overwrite historical snapshot')
    if not (DESTINATION.parents[3]/'.git').exists(): raise ValueError('Expected isolated report worktree not present')
    selected_entries=[x for x in plan['files'] if x['decision']=='include']
    if len({x['destination'] for x in selected_entries})!=len(selected_entries): raise ValueError('Duplicate destination')
    prepared=[]
    known=secrets()+evidence_credentials([(ROOT/x['source']).resolve() for x in plan['files']])
    for entry in selected_entries:
        target=(DESTINATION/entry['destination']).resolve()
        if not target.is_relative_to(DESTINATION.resolve()): raise ValueError('Escaping destination')
        data=derive(entry)
        if HASH(data)!=entry['published_sha256']: raise ValueError('Derived bytes differ')
        if not target.suffix.lower() in ('.png','.jpg','.jpeg'):
            if any(value in data.decode('utf-8',errors='replace') for _,value in known): raise ValueError('Credential detected before copying')
        prepared.append((target,data))
    # All sources/derived bytes are validated before the first destination write.
    DESTINATION.mkdir(parents=True,exist_ok=False)
    for target,data in prepared:
        target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('xb') as f: f.write(data)
    audit=DESTINATION/'publication'/'PUBLICATION_PLAN.json'
    audit.parent.mkdir(parents=True,exist_ok=True)
    audit.write_text(json.dumps(plan,indent=2)+'\n',encoding='utf-8')
    paths={entry['source']:entry['destination'] for entry in selected_entries if entry['source']!=entry['destination']}
    (audit.parent/'PUBLICATION_PATHS.json').write_text(json.dumps(paths,indent=2)+'\n',encoding='utf-8')
    receipt={'copied_at':datetime.now(timezone.utc).isoformat(),'plan_sha256':HASH(PLAN.read_bytes()),'file_count':len(prepared),'verified':all(HASH(path.read_bytes())==entry['published_sha256'] for (path,_),entry in zip(prepared,selected_entries)),'no_source_file_modified':True}
    (audit.parent/'COPY_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=['inventory','copy'])
    parser.add_argument('--include-dir',action='append',default=[])
    args=parser.parse_args()
    if args.mode=='inventory': inventory(args.include_dir)
    else:
        if args.include_dir: raise ValueError('Copy uses only the saved reviewed plan')
        copy()
