#!/usr/bin/env python3
"""Refresh the government holiday dataset; keep the previous file on failure."""
import json, os, sys, tempfile, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

URL='https://data.ntpc.gov.tw/api/datasets/308DCD75-6434-45BC-A95F-584DA4FED251/json'
OUT=Path(__file__).resolve().parent.parent/'holiday-data.json'

def download():
    records=[]
    seen=set()
    for page in range(200):
        url=URL+'?'+urlencode({'page':page,'size':100})
        req=urllib.request.Request(url,headers={'User-Agent':'DEKPI-holiday-calendar/1.0','Accept':'application/json'})
        with urllib.request.urlopen(req, timeout=40) as res:
            batch=json.load(res)
        if not isinstance(batch,list): raise ValueError('API response is not a list')
        if not batch: break
        fingerprint=json.dumps(batch,ensure_ascii=False,sort_keys=True)
        if fingerprint in seen: raise ValueError('API repeated a page; refusing incomplete download')
        seen.add(fingerprint)
        for row in batch:
            if not isinstance(row,dict) or not {'date','name','isholiday','holidaycategory'}.issubset(row): raise ValueError('Unexpected API fields')
            d=str(row['date'])
            if row['isholiday'] not in ('是','否'): raise ValueError('Unexpected holiday marker')
            if len(d)!=8 or not d.isdigit(): raise ValueError('Unexpected date: '+d)
            datetime.strptime(d,'%Y%m%d')
            records.append({k:row.get(k) for k in ('date','year','name','isholiday','holidaycategory','description')})
    else: raise ValueError('Pagination exceeded limit')
    if len(records)<300: raise ValueError('Too few records; not replacing previous data')
    if len({r['date'] for r in records})!=len(records): raise ValueError('Duplicate dates; not replacing previous data')
    years=sorted({int(r['date'][:4]) for r in records})
    if OUT.exists():
        old=json.loads(OUT.read_text(encoding='utf-8'))
        missing=set(old.get('years',[]))-set(years)
        if missing: raise ValueError('Previously available years missing: '+str(sorted(missing)))
    return {'source':'新北市政府人事處：政府行政機關辦公日曆表','source_url':'https://data.ntpc.gov.tw/api/datasets/308DCD75-6434-45BC-A95F-584DA4FED251/json','checked_at':datetime.now(timezone.utc).isoformat(),'years':years,'records':records}

def main():
    data=download();OUT.parent.mkdir(exist_ok=True,parents=True)
    fd,tmp=tempfile.mkstemp(prefix='.holiday-',dir=OUT.parent)
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as f:json.dump(data,f,ensure_ascii=False,separators=(',',':'))
        os.replace(tmp,OUT)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
    print('Downloaded',len(data['records']),'records for',data['years'])
if __name__=='__main__': main()
