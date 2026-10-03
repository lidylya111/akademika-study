const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const clone = o => JSON.parse(JSON.stringify(o));
const norm = s => String(s||'').toLowerCase().trim().replace(/ё/g,'е').replace(/[^a-zа-я0-9\s-]/gi,'').replace(/\s+/g,' ');
const uid = () => 'id-' + Math.random().toString(36).slice(2,10);
const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

let mode = 'server';
let content = clone(window.DEFAULT_CONTENT);
let student = {name:'Демо-ученик', code:'demo'};
let progress = {};
let adminData = null;
let teacherPin = sessionStorage.getItem('teacherPin') || '';
let currentTopicId = null;
let taskState = {};

const app = $('#app');
const modal = $('#modal');
const modalBox = $('#modalBox');

function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function studentCodeFromUrl(){ return new URLSearchParams(location.search).get('student') || ''; }
function localKey(k){ return `akademika:${k}`; }
function getLocalContent(){ try{return JSON.parse(localStorage.getItem(localKey('content'))) || clone(window.DEFAULT_CONTENT)}catch{return clone(window.DEFAULT_CONTENT)} }
function getLocalProgress(){ try{return JSON.parse(localStorage.getItem(localKey('progress'))) || {}}catch{return {}} }

async function api(path, opts={}){
  const res = await fetch(path, {headers:{'Content-Type':'application/json', ...(teacherPin?{'X-Teacher-Pin':teacherPin}:{}), ...(opts.headers||{})}, ...opts});
  if(!res.ok){ const e=await res.json().catch(()=>({error:'Ошибка'})); throw new Error(e.error||'Ошибка'); }
  return res.json();
}

async function loadState(){
  const code = studentCodeFromUrl();
  try{
    const data = await api('/api/state' + (code?`?student=${encodeURIComponent(code)}`:''));
    content = data.content; student = data.student || student; progress = data.progress || {}; mode='server';
  }catch(e){
    mode='local'; content=getLocalContent(); progress=getLocalProgress();
    student = {name: code ? `Ученик ${code}` : 'Демо-ученик', code: code || 'demo'};
  }
  renderHome();
}

function totalCourseProgress(){
  const total=content.topics.length; if(!total) return 0;
  const done=content.topics.filter(t=>(progress[t.id]?.percent||0)>=70).length;
  return Math.round(done/total*100);
}
function starsFor(percent){ return percent>=90?3:percent>=70?2:percent>0?1:0; }
function starsText(n){ return '★'.repeat(n)+'☆'.repeat(3-n); }

function renderHome(){
  currentTopicId=null;
  const p=totalCourseProgress();
  app.innerHTML=`
    <section class="hero">
      <div class="hero-card">
        <div class="kicker">${escapeHtml(content.courseTitle)}</div>
        <h1>История, которую можно потрогать</h1>
        <p class="lead">Короткие объяснения, интерактивные задания, подсказки и звёзды за прогресс. Начинай с любой темы.</p>
        <div class="student-banner">👋 ${escapeHtml(student.name)}</div>
      </div>
      <div class="progress-card">
        <div><div class="big-star">⭐</div><div class="small">Общий прогресс</div><div class="progress-number">${p}%</div></div>
        <div><div class="progress-bar"><div style="width:${p}%"></div></div><p class="small">Тема считается освоенной от 70%.</p></div>
      </div>
    </section>
    <div class="section-title"><div><h2>Темы курса</h2><p>Первые три темы по учебнику Мединского и Чубарьяна, 2025</p></div></div>
    <section class="topic-grid">
      ${content.topics.map(t=>{
        const tp=progress[t.id]?.percent||0, st=starsFor(tp);
        return `<button class="topic-card" data-topic="${t.id}">
          <div class="topic-num">${escapeHtml(t.number)}</div><div class="topic-emoji">${t.emoji||'📚'}</div>
          <h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.short||'')}</p>
          <div class="topic-footer"><span class="stars">${starsText(st)}</span><span class="go">Открыть →</span></div>
        </button>`
      }).join('')}
    </section>
    ${mode==='local'?`<div class="admin-card" style="margin-top:25px"><b>Демо-режим:</b> сайт открыт как обычный файл. Задания и изменения сохраняются только в этом браузере. После запуска <span class="code">server.py</span> или публикации на хостинге результаты будут общими для учеников и учителя.</div>`:''}
  `;
  $$('.topic-card').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
}

function ensureTaskState(topic){
  if(taskState[topic.id]) return;
  taskState[topic.id]={index:0, solved:{}, attempts:{}, answers:{}, points:{}};
}

function openTopic(id){ currentTopicId=id; const t=content.topics.find(x=>x.id===id); if(!t)return; ensureTaskState(t); renderTopic(t); }
function renderTopic(t){
  const state=taskState[t.id];
  const idx=Math.min(state.index,t.tasks.length-1); state.index=idx;
  const completed=Object.keys(state.solved).length===t.tasks.length && t.tasks.length>0;
  app.innerHTML=`
    <button class="back" id="backHome">← К темам</button>
    <div class="lesson-head"><div><div class="kicker">${escapeHtml(t.number)}</div><h1>${escapeHtml(t.title)}</h1><p class="lead">${escapeHtml(t.short||'')}</p></div><div class="lesson-badge">${t.emoji||'📚'}</div></div>
    <div class="fact-strip">${(t.facts||[]).map(f=>`<div class="fact">${escapeHtml(f)}</div>`).join('')}</div>
    ${completed ? completionHtml(t,state) : `<div class="task-wrap"><nav class="task-nav">${t.tasks.map((q,i)=>`<button data-idx="${i}" class="${i===idx?'active':''} ${state.solved[q.id]?'done':''}">${i+1}. ${escapeHtml(q.title||'Задание')}</button>`).join('')}</nav><section id="taskArea"></section></div>`}
  `;
  $('#backHome').onclick=renderHome;
  if(completed){ $('#againBtn').onclick=()=>{taskState[t.id]={index:0,solved:{},attempts:{},answers:{},points:{}};renderTopic(t)}; return; }
  $$('.task-nav button').forEach(b=>b.onclick=()=>{state.index=+b.dataset.idx;renderTopic(t)});
  renderTask(t,t.tasks[idx],state);
}

function completionHtml(t,state){
  const solved=Object.values(state.solved).filter(Boolean).length;
  const earned=Object.values(state.points||{}).reduce((a,b)=>a+b,0);
  const percent=Math.round(earned/t.tasks.length*100); const stars=starsFor(percent);
  saveProgress(t.id,percent,stars,Object.values(state.attempts).reduce((a,b)=>a+b,0));
  setTimeout(confetti,80);
  return `<div class="completion"><div class="trophy">${percent>=90?'🏆':'🌟'}</div><h2>Урок пройден!</h2><div class="stars" style="font-size:32px">${starsText(stars)}</div><p class="score">${solved} из ${t.tasks.length} заданий • ${percent}%</p><p>${percent>=90?'Отличная работа!':percent>=70?'Тема освоена. Можно двигаться дальше!':'Можно пройти ещё раз и улучшить результат.'}</p><div class="controls" style="justify-content:center"><button class="btn yellow" id="againBtn">Пройти ещё раз</button><button class="btn primary" onclick="renderHome()">К темам</button></div></div>`;
}

async function saveProgress(topicId,percent,stars,attempts){
  progress[topicId]={percent,stars,attempts,date:new Date().toISOString()};
  if(mode==='server'){
    try{await api('/api/progress',{method:'POST',body:JSON.stringify({studentCode:student.code,topicId,percent,stars,attempts})})}catch(e){}
  }else localStorage.setItem(localKey('progress'),JSON.stringify(progress));
}

function markAttempt(state,q,correct){
  state.attempts[q.id]=(state.attempts[q.id]||0)+1;
  if(correct){
    state.solved[q.id]=true;
    state.points=state.points||{};
    if(state.points[q.id]===undefined){
      const n=state.attempts[q.id];
      state.points[q.id]=n===1?1:n===2?.75:.5;
    }
  }
}
function feedback(el,ok,msg,hint){ el.innerHTML=`<div class="feedback ${ok?'ok':'bad'}">${ok?'Верно! ⭐':'Пока не совсем.'} ${escapeHtml(msg||'')}</div>${!ok&&hint?`<div class="feedback hint">💡 ${escapeHtml(hint)}</div>`:''}`; }
function nextButton(t,state,q){ const c=document.createElement('button'); c.className='btn primary'; c.textContent=state.index===t.tasks.length-1?'Завершить тему':'Следующее задание →'; c.onclick=()=>{state.index=Math.min(state.index+1,t.tasks.length-1);renderTopic(t)}; return c; }

function renderTask(t,q,state){
  const area=$('#taskArea');
  area.innerHTML=`<article class="task-card"><div class="task-label">Задание ${state.index+1} из ${t.tasks.length}</div><h2>${escapeHtml(q.title||'Задание')}</h2><div class="question">${escapeHtml(q.question||'')}</div><div id="taskBody"></div><div id="feedback"></div><div id="controls" class="controls"></div></article>`;
  const body=$('#taskBody'), ctr=$('#controls'), fb=$('#feedback');
  const done=!!state.solved[q.id];
  if(q.type==='choice'){
    let sel=state.answers[q.id]??null;
    body.innerHTML=`<div class="options">${q.options.map((o,i)=>`<button class="option ${sel===i?'selected':''}" data-i="${i}">${escapeHtml(o)}</button>`).join('')}</div>`;
    $$('.option',body).forEach(b=>b.onclick=()=>{sel=+b.dataset.i;state.answers[q.id]=sel;$$('.option',body).forEach(x=>x.classList.toggle('selected',+x.dataset.i===sel));});
    const check=document.createElement('button');check.className='btn yellow';check.textContent='Проверить';check.onclick=()=>{if(sel===null)return;const ok=sel===q.correct;markAttempt(state,q,ok);$$('.option',body).forEach(x=>{const i=+x.dataset.i;x.classList.toggle('correct',i===q.correct);x.classList.toggle('wrong',i===sel&&!ok)});feedback(fb,ok,q.explanation,q.hint);if(ok){ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));}};ctr.appendChild(check);
  }
  else if(q.type==='multi'){
    let sel=new Set(state.answers[q.id]||[]);
    body.innerHTML=`<div class="options">${q.options.map((o,i)=>`<button class="option ${sel.has(i)?'selected':''}" data-i="${i}">${escapeHtml(o)}</button>`).join('')}</div>`;
    $$('.option',body).forEach(b=>b.onclick=()=>{const i=+b.dataset.i;sel.has(i)?sel.delete(i):sel.add(i);state.answers[q.id]=[...sel];b.classList.toggle('selected');});
    const check=document.createElement('button');check.className='btn yellow';check.textContent='Проверить';check.onclick=()=>{const a=[...sel].sort((x,y)=>x-y),c=[...q.correct].sort((x,y)=>x-y),ok=JSON.stringify(a)===JSON.stringify(c);markAttempt(state,q,ok);feedback(fb,ok,q.explanation,q.hint);if(ok){ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));}};ctr.appendChild(check);
  }
  else if(q.type==='text'){
    body.innerHTML=`<input class="text-answer" placeholder="${escapeHtml(q.placeholder||'Введи ответ…')}" value="${escapeHtml(state.answers[q.id]||'')}">`;
    const inp=$('.text-answer',body);inp.oninput=()=>state.answers[q.id]=inp.value;
    const check=document.createElement('button');check.className='btn yellow';check.textContent='Проверить';check.onclick=()=>{const ok=(q.answers||[]).map(norm).includes(norm(inp.value));markAttempt(state,q,ok);feedback(fb,ok,q.explanation,q.hint);if(ok){ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));}};ctr.appendChild(check);
  }
  else if(q.type==='order'){
    let items=state.answers[q.id]||shuffle(q.items);state.answers[q.id]=items;
    const draw=()=>{body.innerHTML=`<div class="order-list">${items.map((o,i)=>`<div class="order-item" draggable="true" data-i="${i}"><span class="drag-handle">☰</span><b>${i+1}</b> ${escapeHtml(o)}<span class="mini-actions"><button data-up="${i}">↑</button><button data-down="${i}">↓</button></span></div>`).join('')}</div>`;$$('[data-up]',body).forEach(b=>b.onclick=()=>move(+b.dataset.up,-1));$$('[data-down]',body).forEach(b=>b.onclick=()=>move(+b.dataset.down,1));let from=null;$$('.order-item',body).forEach(el=>{el.ondragstart=()=>from=+el.dataset.i;el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const to=+el.dataset.i;if(from===null||from===to)return;const [x]=items.splice(from,1);items.splice(to,0,x);state.answers[q.id]=items;draw();}})};
    const move=(i,d)=>{const j=i+d;if(j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];state.answers[q.id]=items;draw()};draw();
    const check=document.createElement('button');check.className='btn yellow';check.textContent='Проверить порядок';check.onclick=()=>{const ok=JSON.stringify(items)===JSON.stringify(q.items);markAttempt(state,q,ok);feedback(fb,ok,q.explanation,q.hint);if(ok){ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));}};ctr.appendChild(check);
  }
  else if(q.type==='match'){
    const rights=shuffle(q.pairs.map(p=>p[1]));let ans=state.answers[q.id]||{};state.answers[q.id]=ans;
    body.innerHTML=`<div class="match-grid">${q.pairs.map((p,i)=>`<div class="match-row"><div class="match-left">${escapeHtml(p[0])}</div><select class="match-select" data-i="${i}"><option value="">Выбери пару…</option>${rights.map(r=>`<option ${ans[i]===r?'selected':''}>${escapeHtml(r)}</option>`).join('')}</select></div>`).join('')}</div>`;
    $$('.match-select',body).forEach(s=>s.onchange=()=>{ans[s.dataset.i]=s.value;state.answers[q.id]=ans});
    const check=document.createElement('button');check.className='btn yellow';check.textContent='Проверить пары';check.onclick=()=>{const ok=q.pairs.every((p,i)=>ans[i]===p[1]);markAttempt(state,q,ok);feedback(fb,ok,q.explanation,q.hint);if(ok){ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));}};ctr.appendChild(check);
  }
  else if(q.type==='sort'){
    const all=q.categories.flatMap(c=>c.items.map(item=>({item,cat:c.name})));let assign=state.answers[q.id]||{};state.answers[q.id]=assign;
    const render=()=>{const un=all.filter(x=>!assign[x.item]);body.innerHTML=`<div class="sort-pool" data-bin=""><b style="width:100%">Карточки:</b>${un.map(x=>`<button class="chip" draggable="true" data-item="${escapeHtml(x.item)}">${escapeHtml(x.item)}</button>`).join('')}</div><div class="bins">${q.categories.map(c=>`<div class="bin" data-bin="${escapeHtml(c.name)}"><h4>${escapeHtml(c.name)}</h4>${all.filter(x=>assign[x.item]===c.name).map(x=>`<button class="chip" draggable="true" data-item="${escapeHtml(x.item)}">${escapeHtml(x.item)}</button>`).join('')}</div>`).join('')}</div>`;$$('.chip',body).forEach(ch=>{ch.onclick=()=>{const item=ch.dataset.item;const idx=q.categories.findIndex(c=>c.name===assign[item]);assign[item]=idx<0?q.categories[0].name:q.categories[(idx+1)%q.categories.length].name;state.answers[q.id]=assign;render()};ch.ondragstart=e=>e.dataTransfer.setData('text/plain',ch.dataset.item)});$$('[data-bin]',body).forEach(bin=>{bin.ondragover=e=>e.preventDefault();bin.ondrop=e=>{e.preventDefault();const item=e.dataTransfer.getData('text/plain');assign[item]=bin.dataset.bin||null;state.answers[q.id]=assign;render();}})};render();
    const check=document.createElement('button');check.className='btn yellow';check.textContent='Проверить';check.onclick=()=>{const ok=all.every(x=>assign[x.item]===x.cat);markAttempt(state,q,ok);feedback(fb,ok,q.explanation,q.hint);if(ok){ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));}};ctr.appendChild(check);
  }
  else if(q.type==='canvas'){
    body.innerHTML=`<div class="canvas-wrap"><canvas class="draw-canvas" width="900" height="420"></canvas></div>`;
    const canvas=$('.draw-canvas',body),ctx=canvas.getContext('2d');ctx.lineWidth=7;ctx.lineCap='round';ctx.strokeStyle='#654125';let drawing=false;
    const pos=e=>{const r=canvas.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return [(p.clientX-r.left)*canvas.width/r.width,(p.clientY-r.top)*canvas.height/r.height]};
    const start=e=>{drawing=true;const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);e.preventDefault()};const move=e=>{if(!drawing)return;const [x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke();e.preventDefault()};const end=()=>drawing=false;
    canvas.onmousedown=start;canvas.onmousemove=move;window.addEventListener('mouseup',end,{once:false});canvas.ontouchstart=start;canvas.ontouchmove=move;canvas.ontouchend=end;
    const clear=document.createElement('button');clear.className='btn ghost';clear.textContent='Очистить рисунок';clear.onclick=()=>ctx.clearRect(0,0,canvas.width,canvas.height);ctr.appendChild(clear);
    const doneBtn=document.createElement('button');doneBtn.className='btn yellow';doneBtn.textContent='Готово ⭐';doneBtn.onclick=()=>{markAttempt(state,q,true);feedback(fb,true,q.explanation,'');ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));};ctr.appendChild(doneBtn);
  }
  if(done){feedback(fb,true,q.explanation,'');ctr.innerHTML='';ctr.appendChild(nextButton(t,state,q));}
}

function confetti(){const box=$('#confetti');box.innerHTML='';for(let i=0;i<45;i++){const x=document.createElement('i');x.style.left=Math.random()*100+'vw';x.style.animationDelay=Math.random()*.5+'s';x.style.transform=`rotate(${Math.random()*180}deg)`;x.style.background=["#f4d85a","#4b775c","#b86642","#7760a9"][i%4];box.appendChild(x)}setTimeout(()=>box.innerHTML='',2300)}

function openModal(html){modalBox.innerHTML=html;modal.classList.add('open');}
function closeModal(){modal.classList.remove('open');modalBox.innerHTML='';}
modal.onclick=e=>{if(e.target===modal)closeModal()};

$('#homeBtn').onclick=renderHome;
$('#teacherBtn').onclick=()=>teacherEntry();

async function teacherEntry(){
  if(!teacherPin){
    openModal(`<h2>Режим учителя</h2><p>Введите PIN учителя.</p><div class="field"><input id="pinInput" type="password" placeholder="PIN"></div><div class="controls"><button class="btn primary" id="pinGo">Войти</button><button class="btn ghost" onclick="closeModal()">Отмена</button></div><p class="small">В локальной демо-версии PIN: <span class="code">2468</span>.</p>`);
    $('#pinGo').onclick=async()=>{teacherPin=$('#pinInput').value.trim();sessionStorage.setItem('teacherPin',teacherPin);try{await openAdmin();closeModal()}catch(e){teacherPin='';sessionStorage.removeItem('teacherPin');alert('Неверный PIN')}};
  } else { try{await openAdmin()}catch(e){teacherPin='';sessionStorage.removeItem('teacherPin');teacherEntry()} }
}

async function openAdmin(){
  if(mode==='server') adminData=await api('/api/admin');
  else { if(teacherPin!=='2468')throw new Error('bad pin'); adminData={content,students:[{id:'demo',name:'Демо-ученик',code:'demo'}],results:Object.entries(progress).map(([topicId,p])=>({student_name:'Демо-ученик',topic_id:topicId,...p}))}; }
  renderAdmin('content');
}

function renderAdmin(tab){
  content=adminData.content;
  app.innerHTML=`<div class="spread"><div><div class="kicker">Режим учителя</div><h1 style="font-size:42px;margin:6px 0 20px">Управление курсом</h1></div><button class="btn ghost" id="exitAdmin">Выйти</button></div>
  <div class="admin-shell"><nav class="admin-menu">
    <button data-tab="content" class="${tab==='content'?'active':''}">Темы и задания</button>
    <button data-tab="students" class="${tab==='students'?'active':''}">Ученики и ссылки</button>
    <button data-tab="results" class="${tab==='results'?'active':''}">Результаты</button>
    <button data-tab="backup" class="${tab==='backup'?'active':''}">Резервная копия</button>
  </nav><section class="admin-main" id="adminMain"></section></div>`;
  $('#exitAdmin').onclick=()=>{teacherPin='';sessionStorage.removeItem('teacherPin');renderHome()};
  $$('.admin-menu button').forEach(b=>b.onclick=()=>renderAdmin(b.dataset.tab));
  if(tab==='content')renderAdminContent(); if(tab==='students')renderStudents(); if(tab==='results')renderResults(); if(tab==='backup')renderBackup();
}

function renderAdminContent(){
  const m=$('#adminMain');
  m.innerHTML=`<div class="admin-card"><div class="spread"><div><h2>Темы курса</h2><p class="small">Можно менять название, описание и сами задания.</p></div><button class="btn yellow" id="addTopic">+ Новая тема</button></div></div>${content.topics.map(t=>`<div class="admin-card"><div class="spread"><div><div class="kicker">${escapeHtml(t.number)}</div><h2>${escapeHtml(t.emoji||'📚')} ${escapeHtml(t.title)}</h2><p>${escapeHtml(t.short||'')}</p></div><div class="row"><button class="btn ghost edit-topic" data-id="${t.id}">Изменить тему</button><button class="btn danger delete-topic" data-id="${t.id}">Удалить</button></div></div><h3>Задания (${t.tasks.length})</h3><div>${t.tasks.map((q,i)=>`<div class="task-edit-item spread"><div><b>${i+1}. ${escapeHtml(q.title||q.question)}</b><div class="small">Тип: ${escapeHtml(typeName(q.type))}</div></div><div class="row"><button class="btn ghost move-up" data-t="${t.id}" data-i="${i}">↑</button><button class="btn ghost move-down" data-t="${t.id}" data-i="${i}">↓</button><button class="btn ghost edit-task" data-t="${t.id}" data-q="${q.id}">Изменить</button><button class="btn danger delete-task" data-t="${t.id}" data-q="${q.id}">×</button></div></div>`).join('')}</div><button class="btn primary add-task" data-t="${t.id}">+ Добавить задание</button></div>`).join('')}`;
  $('#addTopic').onclick=()=>editTopic(null);
  $$('.edit-topic').forEach(b=>b.onclick=()=>editTopic(content.topics.find(t=>t.id===b.dataset.id)));
  $$('.delete-topic').forEach(b=>b.onclick=async()=>{if(confirm('Удалить тему вместе с заданиями?')){content.topics=content.topics.filter(t=>t.id!==b.dataset.id);await persistContent();renderAdmin('content')}});
  $$('.add-task').forEach(b=>b.onclick=()=>editTask(b.dataset.t,null));
  $$('.edit-task').forEach(b=>b.onclick=()=>editTask(b.dataset.t,content.topics.find(t=>t.id===b.dataset.t).tasks.find(q=>q.id===b.dataset.q)));
  $$('.delete-task').forEach(b=>b.onclick=async()=>{if(confirm('Удалить задание?')){const t=content.topics.find(t=>t.id===b.dataset.t);t.tasks=t.tasks.filter(q=>q.id!==b.dataset.q);await persistContent();renderAdmin('content')}});
  $$('.move-up').forEach(b=>b.onclick=()=>moveTask(b.dataset.t,+b.dataset.i,-1));$$('.move-down').forEach(b=>b.onclick=()=>moveTask(b.dataset.t,+b.dataset.i,1));
}
function typeName(t){return ({choice:'один ответ',multi:'несколько ответов',text:'ввод текста',order:'порядок',match:'пары',sort:'сортировка',canvas:'рисование'})[t]||t}
async function moveTask(tid,i,d){const t=content.topics.find(t=>t.id===tid),j=i+d;if(j<0||j>=t.tasks.length)return;[t.tasks[i],t.tasks[j]]=[t.tasks[j],t.tasks[i]];await persistContent();renderAdmin('content')}

function editTopic(t){
  const x=t||{id:uid(),number:'§ ',title:'Новая тема',emoji:'📚',short:'',facts:['','',''],tasks:[]};
  openModal(`<h2>${t?'Изменить тему':'Новая тема'}</h2><div class="form-grid">
    <div class="field"><label>Номер</label><input id="etNum" value="${escapeHtml(x.number)}"></div>
    <div class="field"><label>Название</label><input id="etTitle" value="${escapeHtml(x.title)}"></div>
    <div class="field"><label>Эмодзи</label><input id="etEmoji" value="${escapeHtml(x.emoji||'📚')}"></div>
    <div class="field"><label>Короткое описание</label><textarea id="etShort">${escapeHtml(x.short||'')}</textarea></div>
    <div class="field"><label>3 главных факта</label><textarea id="etFacts">${escapeHtml((x.facts||[]).join('\n'))}</textarea><div class="help">Каждый факт с новой строки.</div></div>
  </div><div class="controls"><button class="btn primary" id="saveTopic">Сохранить</button><button class="btn ghost" onclick="closeModal()">Отмена</button></div>`);
  $('#saveTopic').onclick=async()=>{x.number=$('#etNum').value;x.title=$('#etTitle').value;x.emoji=$('#etEmoji').value;x.short=$('#etShort').value;x.facts=$('#etFacts').value.split('\n').map(s=>s.trim()).filter(Boolean);if(!t)content.topics.push(x);await persistContent();closeModal();renderAdmin('content')};
}

function editTask(topicId,q){
  const x=q?clone(q):{id:uid(),type:'choice',title:'Новое задание',question:'',options:['','',''],correct:0,hint:'',explanation:''};
  openModal(`<h2>${q?'Изменить задание':'Новое задание'}</h2><div class="form-grid">
    <div class="field"><label>Тип задания</label><select id="eqType">${['choice','multi','text','order','match','sort','canvas'].map(v=>`<option value="${v}" ${x.type===v?'selected':''}>${typeName(v)}</option>`).join('')}</select></div>
    <div class="field"><label>Название карточки</label><input id="eqTitle" value="${escapeHtml(x.title||'')}"></div>
    <div class="field"><label>Вопрос / инструкция</label><textarea id="eqQuestion">${escapeHtml(x.question||'')}</textarea></div>
    <div id="typeFields"></div>
    <div class="field"><label>Подсказка</label><textarea id="eqHint">${escapeHtml(x.hint||'')}</textarea></div>
    <div class="field"><label>Объяснение после ответа</label><textarea id="eqExp">${escapeHtml(x.explanation||'')}</textarea></div>
  </div><div class="controls"><button class="btn primary" id="saveTask">Сохранить</button><button class="btn ghost" onclick="closeModal()">Отмена</button></div>`);
  const renderFields=()=>{
    const type=$('#eqType').value, box=$('#typeFields');
    if(type==='choice')box.innerHTML=`<div class="field"><label>Варианты ответа</label><textarea id="fOptions">${escapeHtml((x.options||[]).join('\n'))}</textarea><div class="help">Каждый вариант с новой строки.</div></div><div class="field"><label>Номер правильного ответа</label><input id="fCorrect" type="number" min="1" value="${(x.correct??0)+1}"></div>`;
    if(type==='multi')box.innerHTML=`<div class="field"><label>Варианты ответа</label><textarea id="fOptions">${escapeHtml((x.options||[]).join('\n'))}</textarea></div><div class="field"><label>Номера правильных ответов</label><input id="fCorrectMulti" value="${(x.correct||[]).map(i=>i+1).join(', ')}"><div class="help">Например: 1, 3, 4</div></div>`;
    if(type==='text')box.innerHTML=`<div class="field"><label>Допустимые правильные ответы</label><textarea id="fAnswers">${escapeHtml((x.answers||[]).join('\n'))}</textarea><div class="help">Каждый допустимый вариант с новой строки.</div></div>`;
    if(type==='order')box.innerHTML=`<div class="field"><label>Элементы в ПРАВИЛЬНОМ порядке</label><textarea id="fItems">${escapeHtml((x.items||[]).join('\n'))}</textarea><div class="help">На экране ребёнка они будут перемешаны.</div></div>`;
    if(type==='match')box.innerHTML=`<div class="field"><label>Пары</label><textarea id="fPairs">${escapeHtml((x.pairs||[]).map(p=>p.join(' = ')).join('\n'))}</textarea><div class="help">Формат: термин = объяснение</div></div>`;
    if(type==='sort')box.innerHTML=`<div class="field"><label>Группы и карточки</label><textarea id="fCategories" style="min-height:150px">${escapeHtml((x.categories||[]).map(c=>c.name+' = '+c.items.join(' | ')).join('\n'))}</textarea><div class="help">Одна группа на строку. Формат: Название группы = карточка 1 | карточка 2 | карточка 3</div></div>`;
    if(type==='canvas')box.innerHTML=`<div class="feedback hint">🎨 Ребёнок получит поле для рисования. Дополнительных правильных ответов не требуется.</div>`;
  }; renderFields(); $('#eqType').onchange=renderFields;
  $('#saveTask').onclick=async()=>{
    const type=$('#eqType').value; x.type=type;x.title=$('#eqTitle').value;x.question=$('#eqQuestion').value;x.hint=$('#eqHint').value;x.explanation=$('#eqExp').value;
    if(type==='choice'){x.options=$('#fOptions').value.split('\n').map(s=>s.trim()).filter(Boolean);x.correct=Math.max(0,+$('#fCorrect').value-1)}
    if(type==='multi'){x.options=$('#fOptions').value.split('\n').map(s=>s.trim()).filter(Boolean);x.correct=$('#fCorrectMulti').value.split(',').map(v=>+v.trim()-1).filter(v=>v>=0)}
    if(type==='text'){x.answers=$('#fAnswers').value.split('\n').map(s=>s.trim()).filter(Boolean)}
    if(type==='order'){x.items=$('#fItems').value.split('\n').map(s=>s.trim()).filter(Boolean)}
    if(type==='match'){x.pairs=$('#fPairs').value.split('\n').map(s=>s.split('=').map(v=>v.trim())).filter(p=>p.length>=2&&p[0]&&p[1]).map(p=>[p[0],p.slice(1).join(' = ')])}
    if(type==='sort'){x.categories=$('#fCategories').value.split('\n').map(line=>{const parts=line.split('=');const name=(parts.shift()||'').trim();const items=parts.join('=').split('|').map(v=>v.trim()).filter(Boolean);return {name,items}}).filter(c=>c.name&&c.items.length)}
    const t=content.topics.find(t=>t.id===topicId); if(q){const i=t.tasks.findIndex(a=>a.id===q.id);t.tasks[i]=x}else t.tasks.push(x); await persistContent();closeModal();renderAdmin('content');
  };
}

async function persistContent(){
  adminData.content=content;
  if(mode==='server') await api('/api/content',{method:'PUT',body:JSON.stringify(content)});
  else localStorage.setItem(localKey('content'),JSON.stringify(content));
}

function renderStudents(){
  const m=$('#adminMain'); const origin=location.origin==='null'?'https://ВАШ-САЙТ.ru':location.origin;
  m.innerHTML=`<div class="admin-card"><div class="spread"><div><h2>Ученики</h2><p class="small">Каждому можно дать отдельную ссылку. Ребёнку не нужен ваш аккаунт.</p></div><button class="btn yellow" id="addStudent">+ Добавить ученика</button></div></div><div class="admin-card">${(adminData.students||[]).length?adminData.students.map(s=>`<div class="student-item"><div class="spread"><div><b>${escapeHtml(s.name)}</b><div class="small">Код: <span class="code">${escapeHtml(s.code)}</span></div><div class="small code" style="margin-top:6px;word-break:break-all">${origin}${location.pathname}?student=${encodeURIComponent(s.code)}</div></div><div class="row"><button class="btn ghost copy-link" data-code="${escapeHtml(s.code)}">Копировать ссылку</button><button class="btn danger del-student" data-id="${s.id}">Удалить</button></div></div></div>`).join(''):'<div class="empty">Пока нет учеников.</div>'}</div>`;
  $('#addStudent').onclick=()=>{openModal(`<h2>Новый ученик</h2><div class="field"><label>Имя</label><input id="studentName" placeholder="Например, Матвей"></div><div class="controls"><button class="btn primary" id="saveStudent">Создать ссылку</button><button class="btn ghost" onclick="closeModal()">Отмена</button></div>`);$('#saveStudent').onclick=async()=>{const name=$('#studentName').value.trim();if(!name)return;if(mode==='server'){const r=await api('/api/students',{method:'POST',body:JSON.stringify({name})});adminData.students.push(r.student)}else{adminData.students.push({id:uid(),name,code:Math.random().toString(36).slice(2,8).toUpperCase()})}closeModal();renderStudents()}};
  $$('.copy-link').forEach(b=>b.onclick=async()=>{const url=`${origin}${location.pathname}?student=${encodeURIComponent(b.dataset.code)}`;try{await navigator.clipboard.writeText(url);b.textContent='Скопировано ✓'}catch{prompt('Скопируйте ссылку:',url)}});
  $$('.del-student').forEach(b=>b.onclick=async()=>{if(!confirm('Удалить ученика и его результаты?'))return;if(mode==='server')await api('/api/students/'+b.dataset.id,{method:'DELETE'});adminData.students=adminData.students.filter(s=>s.id!==b.dataset.id);renderStudents()});
}

function renderResults(){
  const m=$('#adminMain'); const topicMap=Object.fromEntries(content.topics.map(t=>[t.id,`${t.number} ${t.title}`]));
  const rs=(adminData.results||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  m.innerHTML=`<div class="admin-card"><h2>Результаты учеников</h2><p class="small">Сохраняются после завершения темы.</p></div><div class="admin-card">${rs.length?rs.map(r=>`<div class="result-item spread"><div><b>${escapeHtml(r.student_name||r.studentName||'Ученик')}</b><div>${escapeHtml(topicMap[r.topic_id]||r.topicId||'Тема')}</div><div class="small">${r.date?new Date(r.date).toLocaleString('ru-RU'):''}</div></div><div style="text-align:right"><b>${r.percent||0}%</b><div class="stars">${starsText(+r.stars||0)}</div><div class="small">Попыток: ${r.attempts||0}</div></div></div>`).join(''):'<div class="empty">Результатов пока нет.</div>'}</div>`;
}

function renderBackup(){
  const m=$('#adminMain');m.innerHTML=`<div class="admin-card"><h2>Резервная копия</h2><p>Скачайте JSON-файл перед большими изменениями. Его можно импортировать обратно.</p><div class="controls"><button class="btn yellow" id="downloadBackup">Скачать копию</button><label class="btn ghost">Импортировать JSON<input id="importBackup" type="file" accept="application/json" class="hidden"></label><button class="btn danger" id="resetCourse">Вернуть исходные 3 темы</button></div></div>`;
  $('#downloadBackup').onclick=()=>{const blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='akademika-course-backup.json';a.click();URL.revokeObjectURL(a.href)};
  $('#importBackup').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const obj=JSON.parse(await f.text());if(!obj.topics)throw 0;content=obj;await persistContent();alert('Курс импортирован');renderAdmin('content')}catch{alert('Не удалось прочитать файл')}};
  $('#resetCourse').onclick=async()=>{if(confirm('Вернуть исходные темы и задания? Ваши изменения будут заменены.')){content=clone(window.DEFAULT_CONTENT);await persistContent();renderAdmin('content')}};
}

loadState();
