const slides=[...document.querySelectorAll('.hero-slide')],dots=[...document.querySelectorAll('.hero-dot')];let current=0,timer;
function show(n){current=(n+slides.length)%slides.length;slides.forEach((s,i)=>s.classList.toggle('active',i===current));dots.forEach((d,i)=>d.classList.toggle('active',i===current))}
function restart(){clearInterval(timer);timer=setInterval(()=>show(current+1),6000)}
document.querySelector('.hero-next').onclick=()=>{show(current+1);restart()};
document.querySelector('.hero-prev').onclick=()=>{show(current-1);restart()};
dots.forEach((d,i)=>d.onclick=()=>{show(i);restart()});
restart();
const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.main-nav');toggle.onclick=()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)};
nav.querySelectorAll('a').forEach(a=>a.onclick=()=>nav.classList.remove('open'));
document.getElementById('year').textContent=new Date().getFullYear();

// Traditional Wedding gallery lightbox
(function(){
  const items=[...document.querySelectorAll('.traditional-item')];
  if(!items.length) return;
  const box=document.createElement('div');
  box.className='traditional-lightbox';
  box.innerHTML='<button class="traditional-lightbox-close" aria-label="Close">×</button><img alt="Traditional Wedding preview">';
  document.body.appendChild(box);
  const img=box.querySelector('img');
  const close=()=>{box.classList.remove('open');document.body.style.overflow='';};
  items.forEach(item=>item.addEventListener('click',()=>{img.src=item.dataset.full;box.classList.add('open');document.body.style.overflow='hidden';}));
  box.addEventListener('click',e=>{if(e.target===box||e.target.classList.contains('traditional-lightbox-close'))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
})();
