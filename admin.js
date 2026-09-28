const state={files:[],categories:[],activeCategory:"main-page",view:"dashboard",selected:null};
const $=s=>document.querySelector(s);

function toast(message){
  const el=$("#toast");el.textContent=message;el.className="toast show";
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.className="toast",3200);
}

async function api(url,options={}){
  const r=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok){const e=new Error(d.error||"Request failed");e.status=r.status;throw e}
  return d;
}

function showLogin(){$("#loginView").classList.remove("hidden");$("#appView").classList.add("hidden")}
function showApp(){$("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden")}
function size(n){if(!n)return"";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<3){n/=1024;i++}return n.toFixed(i?1:0)+" "+u[i]}

async function load(){
  const d=await api("/api/admin/catalog");state.files=d.files||[];state.categories=d.categories||[];
  if(!state.categories.some(c=>c.key===state.activeCategory))state.activeCategory=state.categories[0]?.key||"main-page";
  $("#stats").innerHTML=[["images",d.totals.images,"TOTAL IMAGES"],["videos",d.totals.videos,"TOTAL VIDEOS"],["categories",d.totals.categories,"MEDIA SECTIONS"]].map(x=>'<div class="stat"><b>'+x[1]+'</b><span>'+x[2]+"</span></div>").join("");
  renderOverview();renderTabs();renderMedia();
}

function renderOverview(){
  const counts={};state.files.forEach(f=>counts[f.categoryKey]=(counts[f.categoryKey]||0)+1);
  $("#categoryOverview").innerHTML=state.categories.map(c=>'<button class="overview-card" data-cat="'+c.key+'"><h4>'+c.label+'</h4><span>'+(counts[c.key]||0)+" media files · Manage →</span></button>").join("");
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{state.activeCategory=b.dataset.cat;state.view=state.activeCategory==="all-videos"?"videos":"images";setView()});
}

function renderTabs(){
  $("#categoryTabs").innerHTML=state.categories.filter(c=>c.key!=="all-videos").map(c=>'<button class="tab '+(c.key===state.activeCategory?"active":"")+'" data-tab="'+c.key+'">'+c.label+"</button>").join("");
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.activeCategory=b.dataset.tab;state.view="images";renderTabs();renderMedia()});
}

function renderMedia(){
  const q=($("#searchInput").value||"").toLowerCase().trim();
  let arr=state.view==="videos"?state.files.filter(f=>f.type==="video"):state.files.filter(f=>f.categoryKey===state.activeCategory);
  if(q)arr=arr.filter(f=>f.name.toLowerCase().includes(q));
  $("#mediaGrid").innerHTML=arr.map(f=>{
    const media=f.type==="image"?'<img src="'+f.preview+'" alt="" loading="lazy">':'<video src="'+f.preview+'" controls preload="metadata"></video>';
    return '<article class="media-card"><div class="media-preview">'+media+'</div><div class="media-info"><strong>'+f.name+'</strong><small>'+size(f.size)+' · '+f.category+'</small><button class="replace-btn" data-path="'+encodeURIComponent(f.path)+'">REPLACE — SAME FILENAME</button></div></article>';
  }).join("");
  $("#emptyState").classList.toggle("hidden",arr.length>0);
  document.querySelectorAll("[data-path]").forEach(b=>b.onclick=()=>openReplace(state.files.find(f=>f.path===decodeURIComponent(b.dataset.path))));
}

function setView(v=state.view){
  state.view=v;$("#dashboardView").classList.toggle("hidden",v!=="dashboard");$("#mediaView").classList.toggle("hidden",v==="dashboard");
  document.querySelectorAll(".side-link").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
  $("#pageTitle").textContent=v==="dashboard"?"Dashboard":v==="videos"?"Video Library":"Image Library";
  renderTabs();renderMedia();
}

function openReplace(f){
  if(!f||f.type!=="image"){toast("Video replacement needs dedicated media storage and is not enabled yet.");return}
  state.selected=f;$("#modalTitle").textContent="Replace "+f.name;$("#requiredFilename").textContent=f.name;$("#replacementFile").value="";$("#selectedFileText").textContent="Choose replacement image";$("#fileValidation").textContent="";$("#confirmReplace").disabled=true;$("#replacePreview").innerHTML='<img src="'+f.preview+'" alt="">';$("#replaceModal").classList.remove("hidden");
}
function closeReplace(){state.selected=null;$("#replaceModal").classList.add("hidden")}

$("#replacementFile").onchange=e=>{
  const f=e.target.files?.[0],t=state.selected;if(!f||!t)return;
  if(f.name!==t.name){$("#fileValidation").textContent="Filename mismatch. Required: "+t.name;$("#confirmReplace").disabled=true;return}
  if(!f.type.startsWith("image/")){$("#fileValidation").textContent="Please choose an image.";$("#confirmReplace").disabled=true;return}
  if(f.size>3*1024*1024){
  $("#fileValidation").textContent="Image must be 3 MB or smaller.";
  $("#confirmReplace").disabled=true;
  return;
}
  $("#fileValidation").textContent="Filename verified ✓";$("#fileValidation").style.color="#6fc68a";$("#selectedFileText").textContent=f.name;$("#confirmReplace").disabled=false;
};

$("#confirmReplace").onclick=async()=>{
  const t=state.selected,f=$("#replacementFile").files?.[0];if(!t||!f)return;
  $("#confirmReplace").disabled=true;$("#fileValidation").style.color="";$("#fileValidation").textContent="Uploading and replacing…";
  try{
    const reader=new FileReader();
    const base64=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f)});
    await api("/api/admin/replace",{method:"POST",body:JSON.stringify({path:t.path,filename:f.name,base64})});
    $("#fileValidation").style.color="#6fc68a";$("#fileValidation").textContent="Replaced successfully ✓";toast(f.name+" replaced successfully.");
    setTimeout(async()=>{closeReplace();await load()},900);
  }catch(e){$("#fileValidation").style.color="";$("#fileValidation").textContent=e.message;$("#confirmReplace").disabled=false}
};

$("#loginForm").onsubmit=async e=>{
  e.preventDefault();$("#loginError").textContent="";
  try{await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:$("#username").value.trim(),password:$("#password").value})});showApp();await load()}
  catch(e){$("#loginError").textContent=e.message}
};
$("#logoutBtn").onclick=async()=>{await api("/api/admin/logout",{method:"POST"}).catch(()=>{});showLogin()};
$("#refreshBtn").onclick=async()=>{try{await load();toast("Media library refreshed.")}catch(e){if(e.status===401)showLogin()}};
document.querySelectorAll(".side-link").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;setView()});
$("#searchInput").oninput=renderMedia;$("#closeModal").onclick=closeReplace;$("#cancelReplace").onclick=closeReplace;$(".modal-backdrop").onclick=closeReplace;

(async()=>{try{await load();showApp()}catch(e){showLogin()}})();
