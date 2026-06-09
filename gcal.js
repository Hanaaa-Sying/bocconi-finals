// Shared Google Calendar two-way sync module for J人时刻 (dashboard.html + merge.html).
// Pure client-side via Google Identity Services token client — no backend, works on https origin.
(function(global){
  const CLIENT_ID_KEY='jhub_gcal_client_id';
  const DEFAULT_CLIENT_ID='286116672684-6lji9cau89o4vu3ohh116m1sa9bbejch.apps.googleusercontent.com';
  const SCOPE='https://www.googleapis.com/auth/calendar.events';
  let accessToken=null, tokenExp=0;

  function getClientId(){return localStorage.getItem(CLIENT_ID_KEY)||DEFAULT_CLIENT_ID;}
  function setClientId(id){localStorage.setItem(CLIENT_ID_KEY,(id||'').trim());}
  function configured(){return !!getClientId();}

  function loadGis(){
    return new Promise((res,rej)=>{
      if(global.google&&global.google.accounts&&global.google.accounts.oauth2)return res();
      const s=document.createElement('script');
      s.src='https://accounts.google.com/gsi/client';
      s.async=true;s.defer=true;
      s.onload=()=>res();
      s.onerror=()=>rej(new Error('Google 登录脚本加载失败（检查网络/能否访问 Google）'));
      document.head.appendChild(s);
    });
  }

  async function connect(){
    const cid=getClientId();
    if(!cid)throw new Error('未设置 Client ID');
    await loadGis();
    return new Promise((resolve,reject)=>{
      const tc=global.google.accounts.oauth2.initTokenClient({
        client_id:cid, scope:SCOPE,
        callback:(resp)=>{
          if(resp.error){reject(new Error(resp.error_description||resp.error));return;}
          accessToken=resp.access_token;
          tokenExp=Date.now()+((resp.expires_in||3600)*1000)-60000;
          resolve(accessToken);
        },
        error_callback:(err)=>reject(new Error(err.message||'授权被取消'))
      });
      tc.requestAccessToken({prompt:''});
    });
  }

  async function ensureToken(){
    if(accessToken&&Date.now()<tokenExp)return accessToken;
    return connect();
  }

  async function api(method,path,body,_retried){
    const tok=await ensureToken();
    const r=await fetch('https://www.googleapis.com/calendar/v3'+path,{
      method,
      headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    });
    if(r.status===401&&!_retried){accessToken=null;return api(method,path,body,true);}
    if(!r.ok){const t=await r.text();throw new Error('Calendar API '+r.status+': '+t);}
    return r.status===204?null:r.json();
  }

  function listEvents(timeMin,timeMax,calendarId){
    const q='?singleEvents=true&maxResults=2500&timeMin='+encodeURIComponent(timeMin)+'&timeMax='+encodeURIComponent(timeMax);
    return api('GET','/calendars/'+encodeURIComponent(calendarId||'primary')+'/events'+q);
  }
  function insertEvent(ev,calendarId){return api('POST','/calendars/'+encodeURIComponent(calendarId||'primary')+'/events',ev);}
  function patchEvent(id,ev,calendarId){return api('PATCH','/calendars/'+encodeURIComponent(calendarId||'primary')+'/events/'+encodeURIComponent(id),ev);}
  function deleteEvent(id,calendarId){return api('DELETE','/calendars/'+encodeURIComponent(calendarId||'primary')+'/events/'+encodeURIComponent(id));}

  // ── color: map a hex to nearest Google Calendar event colorId (1–11) ──
  const GCAL_COLORS={1:'#7986cb',2:'#33b679',3:'#8e24aa',4:'#e67c73',5:'#f6bf26',6:'#f4511e',7:'#039be5',8:'#616161',9:'#3f51b5',10:'#0b8043',11:'#d50000'};
  function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
  function nearestColorId(hex){
    if(!hex)return '1';
    const [r,g,b]=hex2rgb(hex);let best='1',bd=1e9;
    for(const id in GCAL_COLORS){const [r2,g2,b2]=hex2rgb(GCAL_COLORS[id]);const d=(r-r2)**2+(g-g2)**2+(b-b2)**2;if(d<bd){bd=d;best=id;}}
    return best;
  }
  function nextDay(ds){const d=new Date(ds+'T00:00:00');d.setDate(d.getDate()+1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

  global.GCal={getClientId,setClientId,configured,connect,listEvents,insertEvent,patchEvent,deleteEvent,nearestColorId,nextDay};
})(window);
