// Shared Supabase auth + cloud-sync layer for J人时刻.
// Strategy: localStorage stays the synchronous working cache; Supabase is the
// per-user cloud source of truth. On login we hydrate localStorage from cloud,
// then monkey-patch localStorage.setItem/removeItem to debounce-push synced keys.
// Existing page code keeps using localStorage synchronously, untouched.
(function(global){
  // ── CONFIG ── 填入你的 Supabase 项目信息（anon key 是公开 key，可提交）──
  const SUPABASE_URL = 'https://acvthbbqtpwguofjuezd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_YFEmmY8Zy3uhAK9ANjbBUQ_Ox1yEjPs';

  const GUEST_FLAG = 'jhub_guest';            // sessionStorage
  const SYNCED_USER_KEY = 'jhub_synced_user'; // localStorage marker: whose data is currently cached
  const SUPA_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  let client = null;
  let authed = false;               // true once a logged-in session is confirmed in boot()
  let hydrating = false;            // bypass the setItem patch during hydrate/seed/clear
  let patched = false;
  const dirty = new Map();          // key -> value(string) to upsert
  const removed = new Set();        // keys to delete
  let pushTimer = null;

  // ── which localStorage keys belong to a user's synced data ──
  function isSyncedKey(k){
    if(!k) return false;
    if(k === 'jhub_projects_v1') return true;
    if(/^daily_(days|rewards|linked_meta)_v1$/.test(k)) return true;
    if(/_(plan_v7|scratch_v1|cats_v1|evts_v1|hidden_evts_v1|gcal_map_v1)$/.test(k)) return true;
    return false; // device-local: bocconi_theme, jhub_gcal_client_id, j_anthropic_key, *_last_saved, etc.
  }

  function loadScript(src){
    return new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src=src; s.async=true;
      s.onload=()=>res(); s.onerror=()=>rej(new Error('加载失败: '+src));
      document.head.appendChild(s);
    });
  }

  async function ensureClient(){
    if(client) return client;
    if(!global.supabase) await loadScript(SUPA_JS);
    client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth:{ persistSession:true, autoRefreshToken:true }
    });
    return client;
  }

  function isGuest(){ try{ return sessionStorage.getItem(GUEST_FLAG)==='1'; }catch(e){ return false; } }

  // ── clear all synced keys from localStorage (without echoing to cloud) ──
  function clearAppKeys(){
    hydrating = true;
    const keys=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(isSyncedKey(k)) keys.push(k);}
    keys.forEach(k=>localStorage.removeItem(k));
    hydrating = false;
  }

  function snapshotAppKeys(){
    const snap={};
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(isSyncedKey(k)) snap[k]=localStorage.getItem(k);}
    return snap;
  }

  // ── pull all cloud rows for current user into localStorage ──
  async function hydrate(){
    const { data, error } = await client.from('app_data').select('key,value');
    if(error){ console.error('hydrate error', error); return 0; }
    hydrating = true;
    (data||[]).forEach(row=>{
      try{ localStorage.setItem(row.key, JSON.stringify(row.value)); }catch(e){}
    });
    hydrating = false;
    return (data||[]).length;
  }

  // ── push one snapshot of {key:valueString} to cloud (used for first-login migration) ──
  async function uploadSnapshot(snap, uid){
    const rows = Object.keys(snap).map(k=>({ user_id:uid, key:k, value:_parse(snap[k]) }));
    if(!rows.length) return;
    const { error } = await client.from('app_data').upsert(rows);
    if(error) console.error('migrate upload error', error);
  }

  function _parse(v){ try{ return JSON.parse(v); }catch(e){ return v; } }

  // ── debounced push of dirty/removed keys ──
  function schedulePush(){
    if(isGuest()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPush, 800);
  }
  async function flushPush(){
    if(!client || isGuest()) return;
    const { data:{ user } } = await client.auth.getUser();
    if(!user){ return; }
    const ups=[]; dirty.forEach((v,k)=>{ if(!removed.has(k)) ups.push({ user_id:user.id, key:k, value:_parse(v) }); });
    const dels=[...removed];
    dirty.clear(); removed.clear();
    try{
      if(ups.length){ const {error}=await client.from('app_data').upsert(ups); if(error) console.error('upsert', error); }
      for(const k of dels){ const {error}=await client.from('app_data').delete().eq('key',k); if(error) console.error('delete', error); }
    }catch(e){ console.error('flushPush', e); }
  }

  function installPatch(){
    if(patched) return;
    patched = true;
    const origSet = localStorage.setItem.bind(localStorage);
    const origDel = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function(k,v){
      origSet(k,v);
      if(!hydrating && !isGuest() && isSyncedKey(k)){ removed.delete(k); dirty.set(k,v); schedulePush(); }
    };
    localStorage.removeItem = function(k){
      origDel(k);
      if(!hydrating && !isGuest() && isSyncedKey(k)){ dirty.delete(k); removed.add(k); schedulePush(); }
    };
  }

  // ── main entry for app pages: gate + hydrate + patch ──
  let booted = null;
  function boot(){
    if(booted) return booted;
    booted = (async ()=>{
      // guest mode: skip auth, ensure demo seeded, no cloud
      if(isGuest()){ seedGuestIfNeeded(); return { guest:true }; }

      await ensureClient();
      const { data:{ session } } = await client.auth.getSession();
      if(!session){
        if(!/login\.html$/.test(location.pathname)) location.replace('login.html');
        return { authed:false };
      }
      const uid = session.user.id;

      // decide: cloud authoritative, or first-login migration of local data
      const { count } = await client.from('app_data').select('key',{count:'exact',head:true});
      const prevUser = localStorage.getItem(SYNCED_USER_KEY);
      const localSnap = snapshotAppKeys();
      const hasLocal = Object.keys(localSnap).length>0;

      if(count && count>0){
        clearAppKeys();
        await hydrate();
      } else if(hasLocal && (!prevUser || prevUser===uid)){
        await uploadSnapshot(localSnap, uid);   // migrate existing local data into this account
      } else {
        clearAppKeys(); // local belongs to someone else (or none) → start clean
      }
      hydrating = true; localStorage.setItem(SYNCED_USER_KEY, uid); hydrating = false;

      authed = true;
      installPatch();

      client.auth.onAuthStateChange((evt)=>{
        if(evt==='SIGNED_OUT'){ clearAppKeys(); try{localStorage.removeItem(SYNCED_USER_KEY);}catch(e){} location.replace('login.html'); }
      });

      return { authed:true, user:session.user };
    })();
    return booted;
  }

  // ── auth helpers (used by login.html) ──
  async function signUp(email,pw){ await ensureClient(); return client.auth.signUp({ email, password:pw }); }
  async function signIn(email,pw){ await ensureClient(); return client.auth.signInWithPassword({ email, password:pw }); }
  async function signOut(){
    await ensureClient();
    await client.auth.signOut();
    clearAppKeys();
    try{ localStorage.removeItem(SYNCED_USER_KEY); }catch(e){}
  }
  async function getSession(){ await ensureClient(); const {data}=await client.auth.getSession(); return data.session; }
  function getEmail(){ try{ return (client && client.auth)? undefined : undefined; }catch(e){ return undefined; } }

  // ── guest demo ──
  function startGuest(){
    try{ sessionStorage.setItem(GUEST_FLAG,'1'); }catch(e){}
    clearAppKeys();
    seedGuestIfNeeded(true);
  }
  function exitGuest(){
    try{ sessionStorage.removeItem(GUEST_FLAG); }catch(e){}
    clearAppKeys();
  }
  function seedGuestIfNeeded(force){
    const seeded = sessionStorage.getItem('jhub_guest_seeded')==='1';
    if(seeded && !force) return;
    hydrating = true;
    try{
      const today = new Date();
      const iso = (off)=>{ const d=new Date(today); d.setDate(d.getDate()+off); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
      const projects = [
        { id:'demo_fit', name:'健身计划', created:iso(-20), color:'#7ab8a8' },
        { id:'demo_read', name:'读书 · 每月两本', created:iso(-15), color:'#d8b870' },
        { id:'demo_side', name:'副业 · 小红书', created:iso(-8), color:'#d4a0b8' },
      ];
      localStorage.setItem('jhub_projects_v1', JSON.stringify(projects));
      localStorage.setItem('demo_fit_evts_v1', JSON.stringify([
        { id:'g1', date:iso(2), type:'deadline', label:'体测：引体向上 10 个' },
        { id:'g2', date:iso(6), type:'pres', label:'和教练复盘训练计划' },
      ]));
      localStorage.setItem('demo_fit_plan_v7', JSON.stringify({
        [iso(0)]: [ {id:'gf1',c:'other',t:'胸 + 三头，45 分钟',done:false}, {id:'gf2',c:'other',t:'有氧 20 分钟',done:true} ],
        [iso(1)]: [ {id:'gf3',c:'other',t:'背 + 二头',done:false} ],
      }));
      localStorage.setItem('demo_read_evts_v1', JSON.stringify([
        { id:'g3', date:iso(5), type:'deadline', label:'《思考，快与慢》读完' },
      ]));
      localStorage.setItem('demo_read_plan_v7', JSON.stringify({
        [iso(0)]: [ {id:'gr1',c:'other',t:'读 30 页 + 记笔记',done:false} ],
      }));
      localStorage.setItem('demo_side_evts_v1', JSON.stringify([
        { id:'g4', date:iso(3), type:'deadline', label:'发布第 5 篇笔记' },
        { id:'g5', date:iso(9), type:'exam', label:'复盘本月数据' },
      ]));
      localStorage.setItem('demo_side_plan_v7', JSON.stringify({
        [iso(0)]: [ {id:'gs1',c:'other',t:'拍 3 张配图',done:false}, {id:'gs2',c:'other',t:'写文案初稿',done:false} ],
      }));
      sessionStorage.setItem('jhub_guest_seeded','1');
    }catch(e){ console.error('seedGuest', e); }
    hydrating = false;
  }

  function isAuthed(){ return authed; }

  global.SUPA = { boot, ensureClient, signUp, signIn, signOut, getSession, isAuthed, isGuest, startGuest, exitGuest, isSyncedKey, get client(){ return client; } };
})(window);
