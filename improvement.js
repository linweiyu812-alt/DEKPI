/* DEKPI KPI improvement tracking: additive module, preserves existing report handlers. */
(()=>{'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=['D25','D7','TPLH','GES OSAT','GES SOS','SSSG','SSTG','Sales','第三方使用率','QT','080抱怨率','4128抱怨率','人力配置'];
const fields=['finding','evidence','root_cause','action','outcome'];const labels=['Finding｜發現','Evidence｜證據','Root Cause｜根因','Action｜行動','執行成果'];
let records=[],seq={week:0,month:0},loadedKey='';
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
const style=document.createElement('style');style.textContent=`/* Compact weekly report without changing KPI formulas */#weeklylog .card{padding:12px 14px;margin-bottom:12px}#weeklylog .weekly-grid{font-size:11px}#weeklylog .weekly-grid th,#weeklylog .weekly-grid td{padding:3px 5px}#weeklylog .weekly-grid input{width:67px;min-width:58px;padding:3px}#weeklylog .toolbar{gap:7px}#weeklylog .wk-chart{height:260px}.kpi-improvement .ki-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.ki-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ki-item{border:1px solid #cbd5e1;border-radius:7px;padding:10px;min-width:0}.ki-item h4{margin:0 0 7px;font-size:14px}.ki-item label{display:block;font-size:12px;margin:6px 0}.ki-item input,.ki-item select,.ki-item textarea{box-sizing:border-box;width:100%;font-size:12px;padding:6px;min-width:0}.ki-item textarea{resize:vertical;min-height:58px}.ki-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.ki-item .hint{font-size:11px}.ki-result{border-left:3px solid #64748b;padding-left:10px;white-space:pre-wrap;margin:7px 0}.ki-archive{max-height:180px;overflow:auto}.ki-archive details{margin:4px 0}@media(max-width:850px){.ki-list{grid-template-columns:1fr}}`;document.head.append(style);
async function load(type){const n=++seq[type];if(!permitted())return;const c=center(type),m=sourceMonth(type);if(!c||!m)return;const {data,error}=await sb.from('kpi_improvement_plans').select('*').eq('center',c).in('plan_month',[m,previous(m)]).order('created_at',{ascending:true});if(n!==seq[type])return;if(error){$(type==='week'?'ki-week-status':'ki-month-status').textContent='尚未啟用改善追蹤資料表：請先執行 improvement-update.sql';return;}records=data||[];loadedKey=key(type);render(type)}
function planFor(type){const m=sourceMonth(type);const curr=records.filter(x=>x.plan_month===m&&x.status!=='replaced');const carried=records.filter(x=>x.plan_month===previous(m)&&x.status==='active'&&!records.some(y=>y.plan_month===m&&y.kpi===x.kpi)).map(x=>({...x,id:null,plan_month:m,carry_from:x.id,review:null,_carry:true}));return [...curr,...carried].slice(0,3)}
function render(type){const el=$(type==='week'?'ki-week-body':'ki-month-body'),m=sourceMonth(type),c=center(type);if(!c||!m)return;const plans=planFor(type);$(type==='week'?'ki-week-status':'ki-month-status').textContent=(type==='week'?m+' 追蹤':m+' 計畫')+'｜'+plans.length+'/3';let out='<div class="ki-list">';for(let i=0;i<3;i++){const p=plans[i]||{},editable=!p.id||isOp();out+=`<div class="ki-item" data-slot="${i}"><h4>改善項目 ${i+1}${p._carry?'（延續上月）':''}</h4><label>KPI<select data-p="kpi" ><option value="">請選擇</option>${opts.map(k=>`<option ${k===p.kpi?'selected':''}>${esc(k)}</option>`).join('')}</select></label><label>改善前基準<input data-p="baseline" value="${esc(p.baseline)}" ></label><label>目標<input data-p="target" value="${esc(p.target)}" ></label><label>負責人<input data-p="owner" value="${esc(p.owner)}"></label><label>完成期限<input data-p="deadline" type="date" value="${esc(p.deadline)}"></label>`;
if(type==='month')out+=`<label>月度改善方向<textarea data-p="plan_action">${esc(p.plan_action)}</textarea></label><label>改善狀態<select data-p="status"><option value="active">持續追蹤</option><option value="closed" ${p.status==='closed'?'selected':''}>主管確認結案</option></select></label>`;
else out+=`<details ${i===0?'open':''}><summary>本週四段式分析與成果</summary>${fields.map((f,j)=>`<label>${labels[j]}<textarea data-r="${f}"></textarea></label>`).join('')}</details>`;
out+='</div>'}out+='</div><div class="ki-actions"><button class="btn primary" data-ki-save="'+type+'">儲存三大 KPI '+(type==='week'?'週追蹤':'計畫')+'</button></div><p class="hint">三大 KPI 與原有週報／月報分開儲存，不覆蓋已提交的歷史報告。中心可直接調整 KPI，系統保留已儲存的歷史分析；不需要 OP 審核。</p>';el.innerHTML=out;
if(type==='week')loadReviews(plans)}
async function loadReviews(plans){const week=$('weeklyLogWeek').value;const ids=plans.map(x=>x.id).filter(Boolean);if(!ids.length)return;const {data,error}=await sb.from('kpi_improvement_reviews').select('*').eq('week',week).in('plan_id',ids);if(error)return;plans.forEach((p,i)=>{const r=(data||[]).find(x=>x.plan_id===p.id);if(!r)return;const slot=$('ki-week-body').querySelector(`[data-slot="${i}"]`);fields.forEach(f=>{const el=slot?.querySelector(`[data-r="${f}"]`);if(el)el.value=r[f]||''})})}
async function save(type){if(!permitted())return alert('請先登入');const c=center(type),m=sourceMonth(type),existing=planFor(type),slots=[...$(type==='week'?'ki-week-body':'ki-month-body').querySelectorAll('[data-slot]')];const kpis=slots.map(s=>s.querySelector('[data-p="kpi"]').value).filter(Boolean);if(new Set(kpis).size!==kpis.length)return alert('三項 KPI 不可重複');let done=0;for(let i=0;i<slots.length;i++){const s=slots[i],k=s.querySelector('[data-p="kpi"]').value;if(!k)continue;const old=existing[i];const get=f=>s.querySelector(`[data-p="${f}"]`)?.value||'';const payload={center:c,plan_month:m,kpi:k,baseline:get('baseline'),target:get('target'),owner:get('owner'),deadline:get('deadline')||null,plan_action:type==='month'?get('plan_action'):old?.plan_action||'',status:type==='month'?get('status')||'active':old?.status||'active',carry_from:old?.carry_from||null};let res;if(old?.id&&old.kpi!==k){const close=await sb.from('kpi_improvement_plans').update({status:'replaced'}).eq('id',old.id);if(close.error)return alert('舊 KPI 保存失敗：'+close.error.message);payload.carry_from=old.id;res=await sb.from('kpi_improvement_plans').insert(payload).select('id').single();}else if(old?.id)res=await sb.from('kpi_improvement_plans').update(payload).eq('id',old.id).select('id').single();else res=await sb.from('kpi_improvement_plans').insert(payload).select('id').single();if(res.error)return alert('儲存失敗：'+res.error.message);if(type==='week'){const review={plan_id:res.data.id,center:c,week:$('weeklyLogWeek').value,...Object.fromEntries(fields.map(f=>[f,s.querySelector(`[data-r="${f}"]`)?.value||'']))};const r=await sb.from('kpi_improvement_reviews').upsert(review,{onConflict:'plan_id,week'});if(r.error)return alert('週追蹤儲存失敗：'+r.error.message)}done++}alert('已儲存 '+done+' 項改善追蹤');await load(type)}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ki-save]');if(b)save(b.dataset.kiSave)});
for(const [type,ids] of [['week',['weeklyLogWeek','weeklyLogCenter']],['month',['monthlyReportMonth','monthlyReportCenter']]]){ids.forEach(id=>$(id)?.addEventListener('change',()=>load(type)));document.querySelector(`[data-page="${type==='week'?'weeklylog':'monthlyreport'}"]`)?.addEventListener('click',()=>setTimeout(()=>load(type),120))}
window.addEventListener('dekpi-profile-changed',()=>{records=[];loadedKey='';setTimeout(()=>{load('week');load('month')},450)});
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
 const plans=addon.plans.map(x=>({'追蹤ID':x.id,'中心':x.center,'月份':x.plan_month,'KPI':x.kpi,'基準':x.baseline,'目標':x.target,'負責人':x.owner,'期限':x.deadline,'改善計畫':x.plan_action,'狀態':x.status,'前期追蹤ID':x.carry_from||''}));
 const reviews=addon.reviews.map(x=>({'追蹤ID':x.plan_id,'中心':x.center,'週次':x.week,'Finding':x.finding,'Evidence':x.evidence,'Root Cause':x.root_cause,'Action':x.action,'執行成果':x.outcome}));
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
 $('ki-month-results-body').innerHTML=(plans||[]).map(p=>'<p><strong>'+esc(p.kpi)+'</strong>｜目標 '+esc(p.target)+'｜'+esc(p.status==='closed'?'已結案':'持續追蹤')+'</p>'+reviews.filter(r=>r.plan_id===p.id).map(r=>'<p>'+esc(r.week)+'｜'+esc(r.outcome||r.action||'未填寫執行成果')+'</p>').join('')).join('')||'本月尚無三大 KPI 改善紀錄';
}
$('monthlyReportMonth').addEventListener('change',monthResults);$('monthlyReportCenter').addEventListener('change',monthResults);
window.addEventListener('dekpi-profile-changed',()=>setTimeout(monthResults,500));
// OP six-center summaries for weekly and monthly reports, using the existing OP page.
const opCard=document.createElement('div');opCard.className='card';opCard.id='ki-op-summary';opCard.innerHTML='<div class="ki-head"><h3>六中心三大 KPI 改善追蹤</h3><button class="btn" id="ki-op-refresh">更新改善進度</button></div><p class="hint" id="ki-op-status"></p><div class="table-wrap"><table class="weekly-grid"><thead><tr><th>中心</th><th>KPI</th><th>改善目標</th><th>狀態</th><th>本期 Finding／Evidence／Root Cause／Action／成果</th></tr></thead><tbody id="ki-op-rows"></tbody></table></div>';
$('opSave').closest('.card').insertAdjacentElement('beforebegin',opCard);
const centers=['台北','新北','桃園','台中','台南','高雄'];let opSeq=0;
async function loadOp(){if(!isOp()||!sb)return;const n=++opSeq,kind=$('opKind').value,period=$('opPeriod').value;if(!period)return;
 const m=kind==='weekly'?monthFromWeek(period):period;if(!m)return;const prev=previous(m);
 const {data,error}=await sb.from('kpi_improvement_plans').select('*').in('plan_month',[m,prev]).order('created_at');
 if(n!==opSeq)return;if(error){$('ki-op-status').textContent='無法讀取改善計畫：'+error.message;return}
 const all=data||[],plans=centers.flatMap(c=>{const curr=all.filter(p=>p.center===c&&p.plan_month===m&&p.status!=='replaced');const carry=all.filter(p=>p.center===c&&p.plan_month===prev&&p.status==='active'&&!all.some(q=>q.center===c&&q.plan_month===m&&q.kpi===p.kpi));return [...curr,...carry].slice(0,3)});
 let reviews=[];const ids=plans.map(p=>p.id).filter(Boolean);
 for(let i=0;i<ids.length;i+=100){const r=await sb.from('kpi_improvement_reviews').select('*').in('plan_id',ids.slice(i,i+100));if(r.error)break;reviews.push(...(r.data||[]))}
 if(n!==opSeq)return;
 $('ki-op-status').textContent=kind==='weekly'?period+'｜每週追蹤':m+'｜月度追蹤';
 $('ki-op-rows').innerHTML=plans.map(p=>{const rs=reviews.filter(r=>{if(r.plan_id!==p.id)return false;if(kind==='weekly')return r.week===period;const start=r.week?weekStart(r.week):null;return start&&start.toISOString().slice(0,7)===m});const summary=rs.map(r=>[r.week,r.finding,r.evidence,r.root_cause,r.action,r.outcome].filter(Boolean).join('｜')).join('；');return '<tr><td>'+esc(p.center)+'</td><td>'+esc(p.kpi)+'</td><td>'+esc(p.target)+'</td><td>'+esc(p.status==='closed'?'已結案':p.plan_month===prev?'上月延續':'追蹤中')+'</td><td>'+esc(summary||'尚無本期分析')+'</td></tr>'}).join('')||'<tr><td colspan="5">六中心尚無三大 KPI 追蹤紀錄</td></tr>';
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
