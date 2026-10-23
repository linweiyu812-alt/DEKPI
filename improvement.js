/* DEKPI KPI improvement tracking: additive module, preserves existing report handlers. */
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=['D25','D7','TPLH','GES OSAT','GES SOS','SSSG','SSTG','Sales','第三方使用率','QT','080抱怨率','4128抱怨率','人力配置'];
const fields=['finding','evidence','root_cause','action','outcome'];const labels=['Finding｜發現','Evidence｜證據','Root Cause｜根因','Action｜行動','執行成果'];
let recordsByType={week:[],month:[]},seq={week:0,month:0},loadedKey='';
const draftKey=()=>`dekpi-kpi-week-draft|${center('week')}|${$('weeklyLogWeek')?.value}`;
function saveDraft(){try{const slots=[...$('ki-week-body').querySelectorAll('[data-slot]')];localStorage.setItem(draftKey(),JSON.stringify(slots.map(s=>[...s.querySelectorAll('input,select,textarea')].map(e=>({p:e.dataset.p,r:e.dataset.r,value:e.value})))))}catch(e){console.warn('週報暫存失敗',e)}}
function restoreDraft(){try{const d=JSON.parse(localStorage.getItem(draftKey())||'null');if(!d)return;[...$('ki-week-body').querySelectorAll('[data-slot]')].forEach((s,i)=>(d[i]||[]).forEach(x=>{const el=s.querySelector(x.p?`[data-p=\"${x.p}\"]`:`[data-r=\"${x.r}\"]`);if(el&&x.value!==undefined&&(x.r==='progress_note'||!el.value))el.value=x.value}))}catch(e){console.warn('週報暫存讀取失敗',e)}}
const isOp=()=>['op','admin'].includes(String(currentProfile?.role||'').toLowerCase());
const center=(type)=>isOp()?$(type==='week'?'weeklyLogCenter':'monthlyReportCenter')?.value:currentProfile?.center;
const weekStart=w=>{if(!/^\d{4}-W\d{2}$/.test(w||''))return null;const [y,n]=w.split('-W').map(Number);const d=new Date(Date.UTC(y,0,4));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+7*(n-1));return d};
const monthFromWeek=w=>{if(!weekStart(w))return ''; const [y,n]=w.split('-W').map((x,i)=>i?Number(x):Number(x));const d=new Date(Date.UTC(y,0,4));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+7*(n-1));return d.toISOString().slice(0,7)};
const month=type=>type==='week'?monthFromWeek($('weeklyLogWeek').value):$('monthlyReportMonth').value;
const previous=m=>{const [y,n]=m.split('-').map(Number);return n===1?(y-1)+'-12':y+'-'+String(n-1).padStart(2,'0')};
const next=m=>{const [y,n]=m.split('-').map(Number);return n===12?(y+1)+'-01':y+'-'+String(n+1).padStart(2,'0')};
const sourceMonth=type=>type==='week'?month(type):next(month(type));
const key=type=>`${center(type)}|${sourceMonth(type)}|${type==='week'?$('weeklyLogWeek').value:''}`;
const permitted=()=>!!(sb&&currentProfile&&currentProfile.center||sb&&currentProfile&&isOp());
const panel=type=>$(type==='week'?'wkImprovement':'mrImprovement');
const html=`<div class="card kpi-improvement" id="wkImprovement"><div class="ki-head"><h3>三大 KPI 每週改善追蹤</h3><span class="hint" id="ki-week-status"></span></div><div id="ki-week-body"></div></div>`;
$('wkFooter').insertAdjacentHTML('beforebegin',html);
$('mrFooter').insertAdjacentHTML('beforebegin',`<div class="card kpi-improvement" id="mrImprovement"><div class="ki-head"><h3>下月三大 KPI 改善計畫</h3><span class="hint" id="ki-month-status"></span></div><div id="ki-month-body"></div></div>`);
const style=document.createElement('style');style.textContent=`/* Compact weekly report without changing KPI formulas */#weeklylog .card{padding:12px 14px;margin-bottom:12px}#weeklylog .weekly-grid{font-size:11px}#weeklylog .weekly-grid th,#weeklylog .weekly-grid td{padding:3px 5px}#weeklylog .weekly-grid input{width:67px;min-width:58px;padding:3px}#weeklylog .toolbar{gap:7px}#weeklylog .wk-chart{height:260px}.kpi-improvement .ki-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.ki-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ki-item{border:1px solid #cbd5e1;border-radius:7px;padding:10px;min-width:0}.ki-item h4{margin:0 0 7px;font-size:14px}.ki-item label{display:block;font-size:12px;margin:6px 0}.ki-item input,.ki-item select,.ki-item textarea{box-sizing:border-box;width:100%;font-size:12px;padding:6px;min-width:0}.ki-item textarea{resize:vertical;min-height:58px}.ki-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ki-item .hint{font-size:11px}.ki-mini{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin:8px 0}.ki-original{background:#f8fafc;padding:7px;border-radius:5px;margin:8px 0}.ki-original p{font-size:12px;line-height:1.6}.ki-new-findings{margin-top:9px}.ki-item details summary{cursor:pointer;font-size:12px;font-weight:600}.ki-result{border-left:3px solid #64748b;padding-left:10px;white-space:pre-wrap;margin:7px 0}.ki-four-stage{display:block}.ki-stage{border-top:1px solid #cbd5e1;padding:5px 0}.ki-stage:first-of-type{margin-top:5px}.ki-stage p{margin:3px 0 0;white-space:pre-wrap}.ki-archive{max-height:180px;overflow:auto}.ki-archive details{margin:4px 0}@media(max-width:850px){.ki-list{grid-template-columns:1fr}}`;document.head.append(style);
async function load(type){const n=++seq[type];if(!permitted())return;const c=center(type),m=sourceMonth(type);if(!c||!m)return;const {data,error}=await sb.from('kpi_improvement_plans').select('*').eq('center',c).eq('plan_month',m).order('created_at',{ascending:true});if(n!==seq[type])return;if(error){$(type==='week'?'ki-week-status':'ki-month-status').textContent='尚未啟用改善追蹤資料表：請先執行 improvement-update.sql';return;}recordsByType[type]=data||[];loadedKey=key(type);render(type)}
function planFor(type){const m=sourceMonth(type);return recordsByType[type].filter(x=>x.plan_month===m&&x.status!=='replaced').slice(0,3)}
function render(type){
 const el=$(type==='week'?'ki-week-body':'ki-month-body'),m=sourceMonth(type),c=center(type);
 if(!c||!m)return;const plans=planFor(type);
 $(type==='week'?'ki-week-status':'ki-month-status').textContent=(type==='week'?m+' 追蹤':m+' 計畫')+'｜'+plans.length+'/3';
 let out='<div class="ki-list">';
 for(let i=0;i<3;i++){
  const p=plans[i]||{};
  out+=`<div class="ki-item" data-slot="${i}"><h4>改善項目 ${i+1}${type==='week'&&p.kpi?`｜${esc(p.kpi)}`:''}</h4>`;
  if(type==='month'){
   out+=`<label>KPI<select data-p="kpi"><option value="">請選擇</option>${opts.map(k=>`<option ${k===p.kpi?'selected':''}>${esc(k)}</option>`).join('')}</select></label>`;
   out+=`<label>改善前基準<input data-p="baseline" value="${esc(p.baseline)}"></label><label>目標<input data-p="target" value="${esc(p.target)}"></label><label>負責人<input data-p="owner" value="${esc(p.owner)}"></label>`;
   out+='<div class="ki-plan-fields"><p class="hint">月報建立完整分析，供下月週報追蹤參考。</p>';
   for(let j=0;j<4;j++)out+=`<label>${labels[j]}<textarea data-p="${fields[j]}" placeholder="填寫月度${labels[j]}內容">${esc(p[fields[j]])}</textarea></label>`;
   out+='</div>'; 
  }else{
   out+=`<input type="hidden" data-p="kpi" value="${esc(p.kpi)}">`;
   if(!p.kpi){out+=`<p class="hint">本月尚未設定時，可直接在本週補建本月 KPI 計畫。</p><label>選擇 KPI<select data-p="new_kpi"><option value="">請選擇</option>${opts.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select></label><label>改善前基準<input data-p="baseline"></label><label>改善目標<input data-p="target"></label><label>負責人<input data-p="owner"></label><details><summary>補建月度四段式計畫</summary>${fields.slice(0,4).map((f,j)=>`<label>${labels[j]}<textarea data-p="${f}"></textarea></label>`).join('')}</details><label><strong>本週追蹤及行動</strong><textarea data-r="progress_note" placeholder="記錄本週執行進度與成果"></textarea></label>`;}
   else{
    out+=`<div class="ki-mini"><span>基準：${esc(p.baseline)||'—'}</span><span>目標：${esc(p.target)||'—'}</span></div>`;
    out+='<div class="ki-original ki-four-stage"><strong>四階段分析（可依本週需要調整）</strong><p class="hint">當月首週帶入月報；後續週次沿用最近已儲存週次內容。本週修改不會覆蓋月報或前週。</p><p class="hint ki-inherited-note">正在載入週報內容…</p>';
    for(let j=0;j<4;j++)out+=`<label class="ki-stage"><strong>${labels[j]}</strong><textarea data-r="${fields[j]}" placeholder="${labels[j]}（有需要再修改）">${esc(p[fields[j]]||'')}</textarea></label>`;
    out+='</div>';
    out+='<label><strong>本週追蹤及行動</strong><textarea data-r="progress_note" placeholder="記錄本週執行進度、改善成果、新發現或調整行動；不需要重寫四階段分析。"></textarea></label>';
   }
  }
  out+='</div>';
 }
 out+='</div><div class="ki-actions"><button class="btn primary" data-ki-save="'+type+'">儲存三大 KPI '+(type==='week'?'追蹤進度':'計畫')+'</button></div><p class="hint">月報訂定四階段計畫；週報四階段可編輯：當月首週帶入月報，之後自動沿用同月前一週已儲存的內容；本週追蹤及行動每週獨立填寫。週報修改不會覆蓋月報或其他週次。</p>';
 el.innerHTML=out;if(type==='week'){
  el.querySelectorAll('[data-p="new_kpi"]').forEach(select=>select.addEventListener('change',()=>{
    const slot=select.closest('[data-slot]');if(!slot)return;
    const title=slot.querySelector('h4');if(title)title.textContent='改善項目 '+(Number(slot.dataset.slot)+1)+(select.value?'｜'+select.value:'');
  }));
  loadReviews(plans);
 }
}
async function loadReviews(plans){
 const week=$('weeklyLogWeek').value, centerAtLoad=center('week'), monthAtLoad=sourceMonth('week');
 const ids=plans.map(x=>x.id).filter(Boolean);if(!ids.length)return;
 const valid=()=>$('weeklyLogWeek').value===week&&center('week')===centerAtLoad&&sourceMonth('week')===monthAtLoad;
 // Read all saved reviews within the same plan month. The latest earlier saved week
 // is the starting point, unless this week already has its own saved version.
 const {data,error}=await sb.from('kpi_improvement_reviews').select('*').in('plan_id',ids).order('week',{ascending:false});
 if(error){console.error('載入 KPI 週追蹤失敗',error);const status=$('ki-week-status');if(status)status.textContent='週追蹤讀取失敗：'+error.message;return;}if(!valid())return;
 const weekDate=weekStart(week);
 plans.forEach((p,i)=>{
  const slot=$('ki-week-body').querySelector(`[data-slot="${i}"]`);if(!slot||!p.id)return;
  const entries=(data||[]).filter(r=>r.plan_id===p.id);
  const current=entries.find(r=>r.week===week);
  const previous=entries.find(r=>r.week<week); // plan_id already confines records to the monthly KPI plan; ISO week Mondays can fall in the previous calendar month
  // Old test saves may contain empty strings in one or all four stages.
  // Resolve EACH field independently: this week -> most recent earlier nonblank -> monthly plan.
  // Do not alter persisted records until the user explicitly saves this week.
  let filledFromPrevious=false;
  fields.slice(0,4).forEach(f=>{
   const el=slot.querySelector(`[data-r="${f}"]`);if(!el)return;
   const own=current?.[f];
   if(typeof own==='string'&&own.trim()){el.value=own;return;}
   const earlier=entries.find(r=>r.week<week&&typeof r[f]==='string'&&r[f].trim());
   if(earlier){el.value=earlier[f];filledFromPrevious=true;return;}
   el.value=p[f]??'';
  });
  const note=slot.querySelector('.ki-inherited-note');
  if(note)note.textContent=current?(filledFromPrevious?'已保留本週內容，空白欄位自動補入前週資料':'已載入本週儲存內容'):(previous?`已沿用 ${previous.week} 四階段內容`:'已帶入月報原訂四階段內容');
  // Weekly progress is NEVER copied from a previous week.
  const progress=slot.querySelector('[data-r="progress_note"]');
  if(progress)progress.value=current?(current.progress_note??current.outcome??''):'';
 });
 // A draft from this same week takes precedence over inherited values.
 restoreDraft();
}

async function save(type){
 if(!permitted())return alert('請先登入');
 const c=center(type),m=sourceMonth(type),existing=planFor(type),slots=[...$(type==='week'?'ki-week-body':'ki-month-body').querySelectorAll('[data-slot]')];
 const kpis=slots.map(s=>s.querySelector('[data-p="new_kpi"]')?.value||s.querySelector('[data-p="kpi"]')?.value).filter(Boolean);
 if(new Set(kpis).size!==kpis.length)return alert('三項 KPI 不可重複');
 if(type==='week'&&!kpis.length){saveDraft();return alert('已暫存本週填寫內容。請先在每個要追蹤的區塊選擇 KPI，再按儲存；也可以先到月報建立當月計畫。');}
 let done=0;
 for(let i=0;i<slots.length;i++){
  const slot=slots[i],k=slot.querySelector('[data-p="new_kpi"]')?.value||slot.querySelector('[data-p="kpi"]')?.value;if(!k)continue;
  const old=existing[i],get=f=>slot.querySelector(`[data-p="${f}"]`)?.value||'';
  let id=old?.id;
  if(type==='month'){
   const payload={center:c,plan_month:m,kpi:k,baseline:get('baseline'),target:get('target'),owner:get('owner'),deadline:get('deadline')||null,
    finding:get('finding'),evidence:get('evidence'),root_cause:get('root_cause'),action:get('action'),
    plan_action:get('action'),status:'active',carry_from:null};
   let res;
   if(old?.id&&old.kpi!==k){
    const close=await sb.from('kpi_improvement_plans').update({status:'replaced'}).eq('id',old.id);
    if(close.error)return alert('舊 KPI 保存失敗：'+close.error.message);
    payload.carry_from=old.id;res=await sb.from('kpi_improvement_plans').insert(payload).select('id').single();
   }else if(old?.id)res=await sb.from('kpi_improvement_plans').update(payload).eq('id',old.id).select('id').single();
   else res=await sb.from('kpi_improvement_plans').insert(payload).select('id').single();
   if(res.error)return alert('儲存失敗：'+res.error.message);id=res.data.id;
  }else{
   if(!id){
    const payload={center:c,plan_month:m,kpi:k,baseline:old?.baseline||get('baseline'),target:old?.target||get('target'),owner:old?.owner||get('owner'),deadline:old?.deadline||get('deadline')||null,
     finding:old?.finding||get('finding'),evidence:old?.evidence||get('evidence'),root_cause:old?.root_cause||get('root_cause'),action:old?.action||get('action'),plan_action:old?.plan_action||get('action'),carry_from:null,status:'active'};
    const res=await sb.from('kpi_improvement_plans').insert(payload).select('id').single();
    if(res.error)return alert('建立本月 KPI 失敗：'+res.error.message);id=res.data.id;
   }
   const review={plan_id:id,center:c,week:$('weeklyLogWeek').value,
    ...Object.fromEntries(fields.slice(0,4).map(f=>[f,slot.querySelector(`[data-r="${f}"]`)?.value??get(f)])),
    progress_status:'in_progress',
    progress_note:slot.querySelector('[data-r="progress_note"]')?.value||''};
   review.outcome=review.progress_note;
   const r=await sb.from('kpi_improvement_reviews').upsert(review,{onConflict:'plan_id,week'});
   if(r.error)return alert('週追蹤儲存失敗：'+r.error.message);
  }
  done++;
 }
 if(type==='week'){try{localStorage.removeItem(draftKey())}catch(e){}}
 alert('已儲存 '+done+' 項改善'+(type==='week'?'追蹤':'計畫'));await load(type);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ki-save]');if(b)save(b.dataset.kiSave)});
for(const [type,ids] of [['week',['weeklyLogWeek','weeklyLogCenter']],['month',['monthlyReportMonth','monthlyReportCenter']]]){ids.forEach(id=>$(id)?.addEventListener('change',()=>load(type)));document.querySelector(`[data-page="${type==='week'?'weeklylog':'monthlyreport'}"]`)?.addEventListener('click',()=>setTimeout(()=>load(type),120))}
window.addEventListener('dekpi-profile-changed',()=>{recordsByType={week:[],month:[]};loadedKey='';setTimeout(()=>{load('week');load('month')},450)});
// The original Excel exporter is retained; one export button includes supplementary sheets.
let exportAddon=null;
const isCenterAllowed=c=>isOp()||c===currentProfile?.center;
async function fetchExport(c,month,week){
 if(!sb||!isCenterAllowed(c))throw Error('沒有匯出此中心的權限');
 const {data:plans,error}=await sb.from('kpi_improvement_plans').select('*').eq('center',c).lte('plan_month',month).order('plan_month',{ascending:false}).limit(250);
 if(error)throw error;
 const ids=(plans||[]).map(x=>x.id);let reviews=[];
 for(let i=0;i<ids.length;i+=100){const {data,error:e}=await sb.from('kpi_improvement_reviews').select('*').in('plan_id',ids.slice(i,i+100));if(e)throw e;reviews.push(...(data||[]))}
 return {plans:plans||[],reviews:week?reviews.filter(x=>x.week===week):reviews};
}
window.dekpiPrepareImprovementExport=async(type)=>{
 const c=center(type),m=type==='week'?month(type):month(type),w=type==='week'?$('weeklyLogWeek').value:null;
 exportAddon=await fetchExport(c,m,w);
};
window.dekpiAppendImprovementSheets=(wb,addon=exportAddon)=>{
 if(!addon||!window.XLSX)return;
 const plans=addon.plans.map(x=>({'追蹤ID':x.id,'中心':x.center,'月份':x.plan_month,'KPI':x.kpi,'基準':x.baseline,'目標':x.target,'負責人':x.owner,'期限':x.deadline,'Finding':x.finding,'Evidence':x.evidence,'Root Cause':x.root_cause,'Action':x.action,'改善計畫':x.plan_action,'追蹤月份':x.plan_month,'前期追蹤ID':x.carry_from||''}));
 const reviews=addon.reviews.map(x=>({'追蹤ID':x.plan_id,'中心':x.center,'週次':x.week,'Finding':x.finding,'Evidence':x.evidence,'Root Cause':x.root_cause,'Action':x.action,'執行成果':x.progress_note||x.outcome}));
 const add=(rows,name)=>{if(wb.SheetNames.includes(name))return;const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{'資料狀態':'尚無紀錄'}]);ws['!autofilter']={ref:ws['!ref']};XLSX.utils.book_append_sheet(wb,ws,name)};
 add(plans,'三大KPI計畫');add(reviews,'每週四段式分析');
};
for(const [id,type] of [['wkExport','week'],['mrExport','month']]){
 const btn=$(id),original=btn.onclick;btn.onclick=async()=>{
  if(!permitted())return alert('請先登入');btn.disabled=true;
  try{await window.dekpiPrepareImprovementExport(type);if(original)await original.call(btn)}
  catch(e){alert('匯出失敗：'+e.message)}finally{exportAddon=null;btn.disabled=false}
 };
 btn.textContent='匯出 Excel';
}
// Append improvement sheets at the workbook write point, preserving the original report sheets.
const installWriteHook=()=>{
 if(!window.XLSX?.writeFile||XLSX.writeFile.__dekpiImprovement)return;
 const base=XLSX.writeFile;
 const fn=function(wb,name,...args){if(exportAddon)window.dekpiAppendImprovementSheets(wb);return base.call(this,wb,name,...args)};
 fn.__dekpiImprovement=true;XLSX.writeFile=fn;
};
installWriteHook();
// Read-only reference for last month's improvement outcomes; never overwrite supervisor text.
const ref=document.createElement('details');ref.id='ki-month-results';ref.innerHTML='<summary>本月三大 KPI 改善成果參考（不覆寫原有文字）</summary><div id="ki-month-results-body" class="ki-result">讀取中…</div>';
$('mr-ops-result').insertAdjacentElement('beforebegin',ref);
async function monthResults(){if(!permitted())return;const c=center('month'),m=month('month');if(!c||!m)return;
 const {data:plans,error}=await sb.from('kpi_improvement_plans').select('*').eq('center',c).eq('plan_month',m);
 if(error){$('ki-month-results-body').textContent='改善追蹤資料尚未啟用';return}
 const ids=(plans||[]).map(x=>x.id);let reviews=[];
 if(ids.length){const r=await sb.from('kpi_improvement_reviews').select('*').in('plan_id',ids).order('week');reviews=r.data||[]}
 $('ki-month-results-body').innerHTML=(plans||[]).map(p=>'<p><strong>'+esc(p.kpi)+'</strong>｜目標 '+esc(p.target)+'｜本月追蹤'+'</p>'+reviews.filter(r=>r.plan_id===p.id).map(r=>'<p>'+esc(r.week)+'｜'+esc(r.progress_note||r.outcome||'未填寫執行成果')+'</p>').join('')).join('')||'本月尚無三大 KPI 改善紀錄';
}
$('monthlyReportMonth').addEventListener('change',monthResults);$('monthlyReportCenter').addEventListener('change',monthResults);
window.addEventListener('dekpi-profile-changed',()=>setTimeout(monthResults,500));
// OP six-center summaries for weekly and monthly reports, using the existing OP page.
const opCard=document.createElement('div');opCard.className='card';opCard.id='ki-op-summary';opCard.innerHTML='<div class="ki-head"><h3>六中心三大 KPI 改善追蹤</h3><button class="btn" id="ki-op-refresh">更新改善進度</button></div><p class="hint" id="ki-op-status"></p><div class="table-wrap"><table class="weekly-grid"><thead><tr><th>中心</th><th>KPI</th><th>改善目標</th><th>追蹤月份</th><th>本期 Finding／Evidence／Root Cause／Action／成果</th></tr></thead><tbody id="ki-op-rows"></tbody></table></div>';
$('opSave').closest('.card').insertAdjacentElement('beforebegin',opCard);
const centers=['台北','新北','桃園','台中','台南','高雄'];let opSeq=0;
async function loadOp(){if(!isOp()||!sb)return;const n=++opSeq,kind=$('opKind').value,period=$('opPeriod').value;if(!period)return;
 const m=kind==='weekly'?monthFromWeek(period):period;if(!m)return;
 const {data,error}=await sb.from('kpi_improvement_plans').select('*').eq('plan_month',m).order('created_at');
 if(n!==opSeq)return;if(error){$('ki-op-status').textContent='無法讀取改善計畫：'+error.message;return}
 const all=data||[],plans=centers.flatMap(c=>all.filter(p=>p.center===c&&p.plan_month===m&&p.status!=='replaced').slice(0,3));
 let reviews=[];const ids=plans.map(p=>p.id).filter(Boolean);
 for(let i=0;i<ids.length;i+=100){const r=await sb.from('kpi_improvement_reviews').select('*').in('plan_id',ids.slice(i,i+100));if(r.error)break;reviews.push(...(r.data||[]))}
 if(n!==opSeq)return;
 $('ki-op-status').textContent=kind==='weekly'?period+'｜每週追蹤':m+'｜月度追蹤';
 $('ki-op-rows').innerHTML=plans.map(p=>{const rs=reviews.filter(r=>{if(r.plan_id!==p.id)return false;if(kind==='weekly')return r.week===period;const start=r.week?weekStart(r.week):null;return start&&start.toISOString().slice(0,7)===m});const summary=rs.map(r=>[r.week,r.progress_status,r.progress_note||r.outcome,r.finding,r.evidence,r.root_cause,r.action].filter(Boolean).join('｜')).join('；');return '<tr><td>'+esc(p.center)+'</td><td>'+esc(p.kpi)+'</td><td>'+esc(p.target)+'</td><td>'+esc(p.plan_month)+'</td><td>'+esc(summary||'尚無本期追蹤紀錄')+'</td></tr>'}).join('')||'<tr><td colspan="5">六中心尚無三大 KPI 追蹤紀錄</td></tr>';
}
$('ki-op-refresh').onclick=loadOp;
$('opKind').addEventListener('change',()=>setTimeout(loadOp,150));$('opPeriod').addEventListener('change',loadOp);
window.addEventListener('dekpi-op-report-rendered',loadOp);
window.addEventListener('dekpi-profile-changed',()=>setTimeout(loadOp,600));
// OP export: the same button contains original OP report plus all six centers' improvement history.
window.dekpiPrepareOpImprovementExport=async()=>{
 if(!isOp())throw Error('只有 OP 可匯出全市場');const m=$('opKind').value==='weekly'?monthFromWeek($('opPeriod').value):$('opPeriod').value;
 const {data:plans,error}=await sb.from('kpi_improvement_plans').select('*').lte('plan_month',m).order('plan_month',{ascending:false}).limit(500);
 if(error)throw error;let reviews=[];const ids=(plans||[]).map(x=>x.id);
 for(let i=0;i<ids.length;i+=100){const r=await sb.from('kpi_improvement_reviews').select('*').in('plan_id',ids.slice(i,i+100));if(r.error)throw r.error;reviews.push(...(r.data||[]))}
 exportAddon={plans:plans||[],reviews};
};
window.dekpiClearImprovementExport=()=>{exportAddon=null};
setTimeout(()=>{load('week');load('month');monthResults();loadOp();installWriteHook()},900);
})();
