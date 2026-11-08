"""Real MCP rejection only: initialize, list tools, call nonexistent pay. No backend writes."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
server=ROOT.parent/'scripts/spendconsent_mcp.py'
messages=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'video-v3-evidence','version':'3.0'}}},
 {'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},
 {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'pay','arguments':{'amount':41.80,'currency':'USD'}}}]
env={**os.environ,'SPENDCONSENT_API':'http://127.0.0.1:9','SPENDCONSENT_WEB':'http://127.0.0.1:9'}
r=subprocess.run(['python3',str(server)],input=''.join(json.dumps(m)+'\n' for m in messages),capture_output=True,text=True,env=env,timeout=10,check=True)
replies=[json.loads(s) for s in r.stdout.splitlines()]
assert len(replies)==3 and [r['id'] for r in replies]==[1,2,3]
assert {t['name'] for t in replies[1]['result']['tools']}=={'find_offers','prepare_cart','request_owner_approval','purchase_status'}
assert replies[2]['result']=={'content':[{'type':'text','text':'Unknown tool pay.'}],'isError':True}
evidence={'label':'real MCP session','server':'scripts/spendconsent_mcp.py','server_sha256':hashlib.sha256(server.read_bytes()).hexdigest(),'backend_access':'Disabled for this rejection test: loopback discard port. Unknown tools are rejected before any API call.','transcript':[{'request':m,'response':r} for m,r in zip(messages,replies)],'money_moved_cents':0,'payments_created':0}
(ROOT/'evidence-v3.json').write_text(json.dumps(evidence,indent=2)+'\n')
print('PASS: real tools/call pay → Unknown tool pay.; no backend access or payment')
