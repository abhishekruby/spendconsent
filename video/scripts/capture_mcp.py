"""Capture a real MCP conversation against local AI and cart APIs; no payment."""
from pathlib import Path
import json
import re
import select
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
TEXT = 'Exactly 40 microfiber cloths, 40 × 40 cm, under $60 including delivery and tax, one-time.'


def redact(value):
    text=json.dumps(value,ensure_ascii=False)
    text=re.sub(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}', '[email hidden]',text,flags=re.I)
    text=re.sub(r'https?://[^\s"\\]+','[URL hidden]',text)
    text=re.sub(r'\b[0-9a-f]{8}-[0-9a-f-]{27,}\b','[ID hidden]',text,flags=re.I)
    return json.loads(text)


def main():
    server=subprocess.Popen(['python3',str(ROOT/'scripts/mcp_host.py')],cwd=ROOT,
        stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,bufsize=1)
    transcript=[]

    def rpc(method,params):
        ident=len(transcript)+1
        request={'jsonrpc':'2.0','id':ident,'method':method,'params':params}
        start=time.monotonic()
        server.stdin.write(json.dumps(request)+'\n'); server.stdin.flush()
        if not select.select([server.stdout],[],[],180)[0]: raise RuntimeError('MCP timed out')
        reply=json.loads(server.stdout.readline())
        if reply.get('id')!=ident or 'error' in reply: raise RuntimeError('MCP protocol error')
        result=reply['result']
        transcript.append({'request':redact(request),'response':redact(reply),'seconds':round(time.monotonic()-start,3)})
        if result.get('isError'): raise RuntimeError('Real MCP returned an error; no film evidence claimed')
        return result

    def tool(name,args):
        print('Real MCP call: '+name,flush=True)
        return rpc('tools/call',{'name':name,'arguments':args})['content'][0]['text']

    try:
        rpc('initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'video-evidence','version':'1.0'}})
        tools=rpc('tools/list',{})['tools']
        assert {t['name'] for t in tools} == {'find_offers','prepare_cart','request_owner_approval','purchase_status'}
        offers=tool('find_offers',{'request':TEXT})
        match=re.search(r'offer_id ([0-9a-f-]+):',offers)
        if not match or not offers.startswith('Status: READY.'): raise RuntimeError('Real AI did not return offers')
        cart=tool('prepare_cart',{'offer_id':match[1]})
        approval=tool('request_owner_approval',{})
        if not approval.startswith('Sent to the owner for approval'): raise RuntimeError('Owner browser did not open')
        no_pay='This tool cannot approve or pay; only the owner can, in their own browser.'
        assert no_pay in approval
        excerpts=[{'tool':'find_offers','text':'Status: READY.'},
            {'tool':'prepare_cart','text':re.search(r'total \$[\d.]+ USD',cart)[0]},
            {'tool':'request_owner_approval','text':approval.split(no_pay)[0].strip()},
            {'tool':'request_owner_approval','text':no_pay}]
        for excerpt in excerpts:
            original={'find_offers':offers,'prepare_cart':cart,'request_owner_approval':approval}[excerpt['tool']]
            assert excerpt['text'] in original
        result={'label':'real MCP session','transcript':transcript,'excerpts':excerpts,
            'find_offers_seconds':transcript[2]['seconds'],
            'render_lines':['find_offers',excerpts[0]['text'],'prepare_cart',excerpts[1]['text'],
                'request_owner_approval',excerpts[2]['text'],excerpts[3]['text']]}
        (ROOT/'out/mcp-session.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
        edit_path=ROOT/'src/edit.json'
        edit=json.loads(edit_path.read_text())
        edit.update(mcpLines=result['render_lines'],mcpWaitSeconds=round(result['find_offers_seconds'],1),ready=False)
        edit_path.write_text(json.dumps(edit,indent=2)+'\n')
        print('PASS: real AI, exact cart and real owner-browser handoff; no approve/pay tool.',flush=True)
    finally:
        server.stdin.close()
        server.wait(timeout=10)


if __name__=='__main__': main()
