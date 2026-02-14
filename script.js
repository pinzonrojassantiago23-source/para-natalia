/* ========= PERSONALIZA AQUÍ ========= */
console.log("✅ script.js cargó");

const PERSON_NAME = "Natalia";
const START_DATE  = new Date("2026-02-14T00:00:00");

const COUNTER_TEXT_FUTURE = "Nuestro día llega en…";
const COUNTER_TEXT_PAST   = "Mi amor por ti comenzó hace…";

const MESSAGE = [
  "Natalia:",
  "",
  "Si pudiera elegir un lugar seguro, sería a tu lado.",
  "No porque todo sea perfecto,",
  "sino porque contigo lo real se siente más bonito… y más hogar.",
  "",
  "Esto no es una página.",
  "Es un detalle hecho con calma para decirte:",
  "te amo, Natalia. Y te amo en serio. ✨"
].join("\n");

const photos = [
  { src: "natalia-1.jpg", text: "Eres Única." },
  { src: "natalia-2.jpg", text: "Eres Especial." },
  { src: "natalia-3.jpg", text: "Eres Maravillosa." },
  { src: "natalia-4.jpg", text: "Gracias por existir, Natuchis." },
];
/* =================================== */

/* ===== Config PRO ===== */
const CFG = {
  MAX_HEARTS: 520,
  MAX_SPARKLES: 240,
  HEART_TARGETS: 260,
  BLOOM_END_DOCKED: 190,

  REVEAL_DELAY_MS: 900,
  TYPING_SPEED: 18,
  HEART_GLOW: 18,
  DUST_ORBS: 12,

  // Composición (lo que arregla alineación)
  BLOOM_POS_X: 0.52,   // centro del corazón en el canvas
  BLOOM_POS_Y: 0.33,
  TRUNK_BASE_X: 0.52,  // base del tronco
  TRUNK_BASE_Y: 0.87,

  // Ajustes de árbol
  DEPTH_MAX: 7,
  EXTRA_BRANCH_CHANCE: 0.22,
  CROWN_TOP_CLAMP: 0.16, // evita ramas locas arriba
};
/* ===================== */

window.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch (e) {
    console.error("❌ Error inicializando:", e);
    alert("Algo falló cargando la página. Abre la consola (F12) y mira el error rojo.");
  }
});

function init(){
  const $ = (s) => {
    const el = document.querySelector(s);
    if(!el) throw new Error(`No existe el elemento en HTML: ${s}`);
    return el;
  };

  const typedEl = $("#typed");
  const timeEl = $("#time");
  const counterTitleEl = $("#counterTitle");

  const intro = $("#intro");
  const btnStart = $("#btnStart");
  const btnSurprise = $("#btnSurprise");
  const btnReplay = $("#btnReplay");

  const gallery = $("#gallery");
  const slider = $("#slider");
  const dotsWrap = $("#dots");
  const prevBtn = $("#prev");
  const nextBtn = $("#next");

  // Siluetas (si existen)
  const silhouettesImg = document.querySelector("#siluetas");

  $("#name").textContent = PERSON_NAME;

  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  /* ===== Double buffer ===== */
  const buffer = document.createElement("canvas");
  const bctx = buffer.getContext("2d", { alpha: true });

  let W=0, H=0, DPR=1;

  /* ===== Helpers ===== */
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const easeOutCubic=(t)=>1-Math.pow(1-t,3);

  /* ===== Image path auto-detect ===== */
  let ASSET_DIR = "img";
  let photoResolved = [];

  function canLoadImage(url){
    return new Promise((resolve)=>{
      const img = new Image();
      img.onload = ()=>resolve(true);
      img.onerror = ()=>resolve(false);
      img.src = url + `?v=${Date.now()}`;
    });
  }

  async function resolveAssetDir(){
    const test1 = `img/${photos[0].src}`;
    const test2 = `Images/${photos[0].src}`;
    const ok1 = await canLoadImage(test1);
    if(ok1){ ASSET_DIR="img"; return; }
    const ok2 = await canLoadImage(test2);
    if(ok2){ ASSET_DIR="Images"; return; }
    ASSET_DIR="img";
    console.warn("No pude detectar carpeta de imágenes. Revisa nombres/extensiones.");
  }

  async function preloadPhotos(){
    photoResolved = photos.map(p => `${ASSET_DIR}/${p.src}`);
    const results = await Promise.all(photoResolved.map(canLoadImage));
    const failed = results.map((ok,i)=>({ok,i})).filter(x=>!x.ok);
    if(failed.length){
      console.warn("Algunas fotos no cargaron:", failed.map(f=>photoResolved[f.i]));
    }
  }

  /* ===== Resize ===== */
  function resize(){
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const r = canvas.getBoundingClientRect();
    W = Math.floor(r.width);
    H = Math.floor(r.height);

    canvas.width  = Math.floor(W*DPR);
    canvas.height = Math.floor(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);

    buffer.width  = Math.floor(W*DPR);
    buffer.height = Math.floor(H*DPR);
    bctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener("resize", () => {
    resize();
    // recomponer cuando cambie el tamaño
    if(W && H && running){
      setBloomCenter();
      rebuildTreeKeepingBloom();
    }
  });

  /* ===== Counter ===== */
  function formatDiff(ms){
    const sec = Math.floor(ms/1000);
    const days = Math.floor(sec/(3600*24));
    const hours = Math.floor((sec%(3600*24))/3600);
    const mins  = Math.floor((sec%3600)/60);
    const secs  = sec%60;
    return `${days} días  ${hours} horas  ${mins} minutos  ${secs} segundos`;
  }
  function updateCounter(){
    const now = new Date();
    const diff = now - START_DATE;
    if(diff < 0){
      counterTitleEl.textContent = COUNTER_TEXT_FUTURE;
      timeEl.textContent = formatDiff(Math.abs(diff));
    }else{
      counterTitleEl.textContent = COUNTER_TEXT_PAST;
      timeEl.textContent = formatDiff(diff);
    }
  }
  setInterval(updateCounter, 1000);
  updateCounter();

  /* ===== Typewriter ===== */
  async function typeText(text, speed=18){
    typedEl.textContent = "";
    for(let i=0;i<text.length;i++){
      typedEl.textContent += text[i];
      const ch=text[i];
      let extra=0;
      if(ch==="\n") extra=140;
      if(".!?,".includes(ch)) extra=100;
      await new Promise(r=>setTimeout(r, speed+extra));
    }
  }

  /* ===== Noise ===== */
  function hash1(n){ n=(n<<13)^n; return 1-((n*(n*n*15731+789221)+1376312589)&0x7fffffff)/1073741824; }
  function noise1(x){
    const i=Math.floor(x), f=x-i, u=f*f*(3-2*f);
    return lerp(hash1(i), hash1(i+1), u);
  }

  /* ===== Camera ===== */
  const cam = { x:0, y:0, z:1, tx:0, ty:0, tz:1 };
  function camUpdate(dt){
    const k = 1 - Math.pow(0.001, dt);
    cam.x = lerp(cam.x, cam.tx, k);
    cam.y = lerp(cam.y, cam.ty, k);
    cam.z = lerp(cam.z, cam.tz, k);
  }

  /* ===== Heart field ===== */
  function heartXY(t){
    const x = 16*Math.pow(Math.sin(t),3);
    const y = 13*Math.cos(t) - 5*Math.cos(2*t) - 2*Math.cos(3*t) - Math.cos(4*t);
    return {x,y};
  }
  function generateHeartTargets(count, cx, cy, scale){
    const pts=[];
    for(let i=0;i<count;i++){
      const t = Math.random()*Math.PI*2;
      const p = heartXY(t);
      const r = Math.pow(Math.random(), 0.55);
      pts.push({
        x: cx + p.x*scale*r + rand(-4,4),
        y: cy - p.y*scale*r + rand(-4,4)
      });
    }
    return pts;
  }

  function drawHeart(g, x,y,s,rot,color,alpha=1, glow=false){
    g.save();
    g.translate(x,y);
    g.rotate(rot);
    g.globalAlpha=alpha;

    g.shadowBlur = glow ? CFG.HEART_GLOW : 0;
    if(glow) g.shadowColor=color;

    g.fillStyle=color;
    g.beginPath();
    const top=s*0.3;
    g.moveTo(0, top);
    g.bezierCurveTo(0,0, -s,0, -s,top);
    g.bezierCurveTo(-s,s+top, 0,s+top, 0,s*1.35);
    g.bezierCurveTo(0,s+top, s,s+top, s,top);
    g.bezierCurveTo(s,0, 0,0, 0,top);
    g.closePath();
    g.fill();

    g.restore();
    g.globalAlpha=1;
  }

  /* ===== Tree ===== */
  class CurvedBranch {
    constructor(x,y,angle,len,thick,depth){
      this.x=x; this.y=y;
      this.angle=angle;
      this.len=len;
      this.thick=thick;
      this.depth=depth;
      this.t=0;
      this.done=false;

      // menos “random loco” en niveles altos
      const bendAmp = (0.65 - depth*0.07);
      this.bend = rand(-bendAmp,bendAmp);

      this.cx0 = x + Math.cos(angle + this.bend)*len*0.45;
      this.cy0 = y + Math.sin(angle + this.bend)*len*0.45;
      this.ex  = x + Math.cos(angle)*len;
      this.ey  = y + Math.sin(angle)*len;

      // clamp superior para que no se vaya al borde
      this.ey = Math.max(this.ey, H*CFG.CROWN_TOP_CLAMP);
    }

    grow(dt){
      if(this.done) return;
      const speed = 0.34 + this.depth*0.045;
      this.t = clamp(this.t + dt*speed, 0, 1);
      if(this.t>=1) this.done=true;
    }

    point(u, wind){
      const sway = wind * (0.9 - this.depth*0.12);
      const cx = this.cx0 + sway*16;
      const cy = this.cy0 - Math.abs(sway)*4;
      const x = (1-u)*(1-u)*this.x + 2*(1-u)*u*cx + u*u*this.ex;
      const y = (1-u)*(1-u)*this.y + 2*(1-u)*u*cy + u*u*this.ey;
      return {x,y};
    }

    tip(wind){
      const u = easeOutCubic(this.t);
      return this.point(u, wind);
    }

    draw(g, wind){
      const u = easeOutCubic(this.t);
      const segs=22;
      g.lineCap="round";
      g.lineJoin="round";
      g.lineWidth=this.thick;
      g.strokeStyle="rgba(70,45,35,.92)";
      g.beginPath();
      g.moveTo(this.x,this.y);
      for(let i=1;i<=segs;i++){
        const uu = u*(i/segs);
        const p = this.point(uu, wind);
        g.lineTo(p.x,p.y);
      }
      g.stroke();

      // highlight
      g.lineWidth=Math.max(1, this.thick*0.26);
      g.strokeStyle="rgba(255,255,255,.10)";
      g.beginPath();
      g.moveTo(this.x,this.y);
      for(let i=1;i<=segs;i++){
        const uu = u*(i/segs);
        const p = this.point(uu, wind);
        g.lineTo(p.x+0.5,p.y-0.5);
      }
      g.stroke();
    }
  }

  class Sparkle {
    constructor(x,y){
      this.x=x; this.y=y;
      this.vx=rand(-12,12);
      this.vy=rand(-24,-8);
      this.life=rand(0.9,1.8);
      this.age=0;
      this.r=rand(1.0,2.4);
      this.a=rand(.25,.7);
    }
    step(dt, wind){
      this.age+=dt;
      this.x+= (this.vx + wind*10)*dt;
      this.y+= this.vy*dt;
      this.vy+= 60*dt;
    }
    draw(g){
      const t=clamp(1-this.age/this.life,0,1);
      g.globalAlpha=this.a*t;
      g.fillStyle="rgba(255,255,255,.95)";
      g.beginPath();
      g.arc(this.x,this.y,this.r,0,Math.PI*2);
      g.fill();
      g.globalAlpha=1;
    }
    get dead(){ return this.age>=this.life; }
  }

  class DockHeart {
    constructor(x,y,target){
      this.x=x; this.y=y;
      this.tx=target.x; this.ty=target.y;
      this.vx=rand(-60,60);
      this.vy=rand(-80,-20);
      this.size=rand(7,12);
      this.rot=rand(-0.8,0.8);
      this.spin=rand(-1.8,1.8);
      const pal=["#ff3b6a","#ff5a7a","#ff9a3b","#ffc857","#ff74c6","#ff2d55","#ff6b6b"];
      this.color=pal[(Math.random()*pal.length)|0];
      this.alpha=0;
      this.docked=false;
    }
    step(dt, wind){
      this.alpha = clamp(this.alpha + dt*1.2, 0, 1);
      const dx = this.tx - this.x;
      const dy = this.ty - this.y;
      const k = this.docked ? 26 : 18;
      const d = this.docked ? 7.5 : 6.2;
      const wx = wind*6;
      this.vx += (dx*k + wx - this.vx*d)*dt;
      this.vy += (dy*k       - this.vy*d)*dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      this.rot += this.spin*dt*(this.docked ? 0.15 : 1);
      if(!this.docked && (dx*dx+dy*dy) < 60){
        this.docked=true;
        this.spin *= 0.2;
      }
    }
    draw(g){
      drawHeart(g, this.x, this.y, this.size*1.02, this.rot, this.color, this.alpha*0.35, true);
      drawHeart(g, this.x, this.y, this.size, this.rot, this.color, this.alpha, false);
    }
  }

  /* ===== State ===== */
  let branches=[], sparkles=[], heartsDock=[], bloomTargets=[];
  let phase="idle", running=false, lastT=0;
  let typedDone=false, bloomDone=false, galleryShown=false;

  let TRUNK=null;
  let BLOOM_CENTER={x:0,y:0};

  function setBloomCenter(){
    BLOOM_CENTER.x = W * CFG.BLOOM_POS_X;
    BLOOM_CENTER.y = H * CFG.BLOOM_POS_Y;
  }

  function buildTree(){
    branches=[]; sparkles=[]; heartsDock=[]; bloomTargets=[];
    phase="grow"; bloomDone=false; galleryShown=false;

    setBloomCenter();

    const baseX=W*CFG.TRUNK_BASE_X;
    const baseY=H*CFG.TRUNK_BASE_Y;

    // Tronco llega hacia el bloom
    const dx = (BLOOM_CENTER.x - baseX);
    const dy = (BLOOM_CENTER.y - baseY);
    const angle = Math.atan2(dy, dx);
    const dist = Math.hypot(dx, dy);

    const trunkLen = dist * 0.88;
    const trunk = new CurvedBranch(baseX, baseY, angle, trunkLen, 12, 0);
    TRUNK = trunk;
    branches.push(trunk);

    function spawn(parent, depth){
      if(depth>CFG.DEPTH_MAX) return;

      const px=parent.ex, py=parent.ey;

      // Las ramas van “abrazando” el corazón: ángulos alrededor del eje al bloom
      const aim = Math.atan2(BLOOM_CENTER.y - py, BLOOM_CENTER.x - px);

      const baseLen = parent.len*rand(0.58,0.78);
      const thick = Math.max(1.35, parent.thick*0.66);

      // apertura controlada
      const spread = rand(0.28, 0.62);

      const a1 = aim - spread - rand(0.08,0.22);
      const a2 = aim + spread + rand(0.08,0.22);

      const b1 = new CurvedBranch(px,py,a1,baseLen,thick,depth);
      const b2 = new CurvedBranch(px,py,a2,baseLen,thick,depth);
      branches.push(b1,b2);

      // rama extra ocasional
      if(Math.random()<CFG.EXTRA_BRANCH_CHANCE){
        const a3 = aim + rand(-0.28,0.28);
        const b3 = new CurvedBranch(px,py,a3,baseLen*rand(0.55,0.72),thick*0.85,depth);
        branches.push(b3);
        spawn(b3, depth+1);
      }

      spawn(b1, depth+1);
      spawn(b2, depth+1);
    }

    spawn(trunk,1);
  }

  function rebuildTreeKeepingBloom(){
    // si estás ya en bloom/done, solo recrea targets para que quede en el lugar correcto
    if(!W || !H) return;
    setBloomCenter();
    createBloomTargets();
  }

  function allBranchesDone(){
    for(const b of branches) if(!b.done) return false;
    return true;
  }

  function paintBackground(g, wind, t){
    g.clearRect(0,0,W,H);
    const glow = g.createRadialGradient(W*0.58, H*0.38, 40, W*0.58, H*0.42, Math.max(W,H));
    glow.addColorStop(0, "rgba(255,255,255,.68)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.fillRect(0,0,W,H);

    g.globalAlpha = 0.06;
    g.fillStyle = "rgba(255,255,255,1)";
    for(let i=0;i<CFG.DUST_ORBS;i++){
      const x = (Math.sin(t*0.7 + i*12.3)+1)*0.5*W + wind*10;
      const y = (Math.cos(t*0.6 + i*9.2)+1)*0.5*H*0.75 + 40;
      g.beginPath();
      g.arc(x,y, 16, 0, Math.PI*2);
      g.fill();
    }
    g.globalAlpha = 1;

    const v = g.createRadialGradient(W*0.55, H*0.5, Math.min(W,H)*0.25, W*0.55, H*0.5, Math.max(W,H));
    v.addColorStop(0,"rgba(0,0,0,0)");
    v.addColorStop(1,"rgba(0,0,0,.12)");
    g.fillStyle=v;
    g.fillRect(0,0,W,H);
  }

  function createBloomTargets(){
    const cx = BLOOM_CENTER.x || (W*CFG.BLOOM_POS_X);
    const cy = BLOOM_CENTER.y || (H*CFG.BLOOM_POS_Y);
    const scale = Math.min(W,H) * 0.020;
    bloomTargets = generateHeartTargets(CFG.HEART_TARGETS, cx, cy, scale);
  }

  /* ===== Gallery ===== */
  function buildGallery(){
    slider.innerHTML="";
    dotsWrap.innerHTML="";

    photos.forEach((p, idx) => {
      const slide = document.createElement("div");
      slide.className="slide";

      const img = document.createElement("img");
      img.src = photoResolved[idx] || `${ASSET_DIR}/${p.src}`;
      img.alt = `Foto ${idx+1} de ${PERSON_NAME}`;
      img.loading="lazy";
      img.decoding="async";

      const cap = document.createElement("div");
      cap.className="caption";
      cap.textContent = p.text || "";

      slide.appendChild(img);
      slide.appendChild(cap);
      slider.appendChild(slide);

      const dot = document.createElement("button");
      dot.className="dot";
      dot.type="button";
      dot.setAttribute("aria-label", `Ir a foto ${idx+1}`);
      dot.addEventListener("click",()=>scrollToIndex(idx));
      dotsWrap.appendChild(dot);
    });

    updateNav();
    updateDots(0);
  }

  function currentIndex(){
    const slides = Array.from(slider.children);
    if(!slides.length) return 0;
    const r = slider.getBoundingClientRect();
    const center = r.left + r.width/2;
    let best=0, bestD=1e9;
    slides.forEach((el,i)=>{
      const rr=el.getBoundingClientRect();
      const c=rr.left + rr.width/2;
      const d=Math.abs(c-center);
      if(d<bestD){ bestD=d; best=i; }
    });
    return best;
  }

  function scrollToIndex(i){
    const el=slider.children[i];
    if(!el) return;
    el.scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"});
  }

  function updateDots(i){
    Array.from(dotsWrap.children).forEach((d,idx)=>d.classList.toggle("active", idx===i));
  }

  function updateNav(){
    const idx=currentIndex();
    prevBtn.disabled = idx<=0;
    nextBtn.disabled = idx>=photos.length-1;
  }

  slider.addEventListener("scroll", ()=>{
    const idx=currentIndex();
    updateDots(idx);
    updateNav();
  }, {passive:true});

  prevBtn.addEventListener("click", ()=>scrollToIndex(currentIndex()-1));
  nextBtn.addEventListener("click", ()=>scrollToIndex(currentIndex()+1));

  slider.addEventListener("keydown",(e)=>{
    if(e.key==="ArrowLeft") scrollToIndex(currentIndex()-1);
    if(e.key==="ArrowRight") scrollToIndex(currentIndex()+1);
  });

  function revealGallery(){
    if(galleryShown) return;
    galleryShown = true;
    buildGallery();
    gallery.classList.remove("hidden");
    prevBtn.disabled = true;
    nextBtn.disabled = photos.length<=1;
    setTimeout(()=>slider.focus({preventScroll:true}), 150);
  }

  function tryReveal(){
    if(galleryShown) return;
    if(!typedDone) return;
    if(!bloomDone) return;
    setTimeout(()=>revealGallery(), CFG.REVEAL_DELAY_MS);
  }

  /* ===== Siluetas control ===== */
  function showSilhouettes(){
    if(!silhouettesImg) return;
    silhouettesImg.style.opacity = "0";
    silhouettesImg.style.transition = "opacity 900ms ease";
    // pequeño delay para que aplique el transition
    requestAnimationFrame(()=>{ silhouettesImg.style.opacity = "0.40"; });
  }
  function hideSilhouettes(){
    if(!silhouettesImg) return;
    silhouettesImg.style.opacity = "0";
  }

  /* ===== Main Loop ===== */
  function step(tms){
    if(!running) return;
    const t = tms/1000;
    const dt = lastT ? Math.min(0.033, t-lastT) : 0;
    lastT=t;

    const wind = noise1(t*0.7) * 1.0;

    if(phase==="grow"){
      cam.tx = 0; cam.ty = 0; cam.tz = 1.00;
    } else if(phase==="bloom"){
      cam.tx = -W*0.01; cam.ty = -H*0.03; cam.tz = 1.03;
    } else {
      cam.tx = 0; cam.ty = 0; cam.tz = 1.00;
    }
    camUpdate(dt);

    paintBackground(bctx, wind, t);

    bctx.save();
    bctx.translate(W/2, H/2);
    bctx.scale(cam.z, cam.z);
    bctx.translate(-W/2 - cam.x, -H/2 - cam.y);

    if(phase==="grow"){
      for(const b of branches){
        if(!b.done) b.grow(dt);
        b.draw(bctx, wind);

        if(sparkles.length < CFG.MAX_SPARKLES && Math.random()<0.06){
          const tip=b.tip(wind);
          sparkles.push(new Sparkle(tip.x+rand(-4,4), tip.y+rand(-4,4)));
        }
      }
      if(allBranchesDone()){
        createBloomTargets();
        phase="bloom";
      }
    }else{
      for(const b of branches){
        b.t=1; b.done=true;
        b.draw(bctx, wind);
      }
    }

    if(phase==="bloom"){
      const remaining = CFG.MAX_HEARTS - heartsDock.length;
      if(remaining > 0){
        const spawnN = Math.min(remaining, 8 + Math.floor(Math.random()*8));
        for(let i=0;i<spawnN;i++){
          const target = bloomTargets[(Math.random()*bloomTargets.length)|0];
          if(!target) continue;

          const sx = target.x + rand(-120,120);
          const sy = target.y + rand(40,180);
          heartsDock.push(new DockHeart(sx, sy, target));

          if(sparkles.length < CFG.MAX_SPARKLES && Math.random()<0.30){
            sparkles.push(new Sparkle(target.x, target.y));
          }
        }
      }

      let dockedCount=0;
      for(const h of heartsDock) if(h.docked) dockedCount++;

      if(dockedCount > CFG.BLOOM_END_DOCKED){
        phase="done";
        bloomDone = true;
        btnSurprise.disabled=false;
        btnReplay.disabled=false;
        document.body.classList.add("final-glow");
        showSilhouettes();
        tryReveal();
      }
    }

    for(const h of heartsDock){ h.step(dt, wind); h.draw(bctx); }

    for(let i=sparkles.length-1;i>=0;i--){
      sparkles[i].step(dt, wind);
      sparkles[i].draw(bctx);
      if(sparkles[i].dead) sparkles.splice(i,1);
    }

    bctx.restore();

    ctx.clearRect(0,0,W,H);
    ctx.drawImage(buffer, 0, 0, W, H);

    requestAnimationFrame(step);
  }

  /* ===== Controls ===== */
  async function startSequence(){
    resize();
    await resolveAssetDir();
    await preloadPhotos();

    typedDone=false; bloomDone=false; galleryShown=false;
    document.body.classList.remove("final-glow");
    hideSilhouettes();

    buildTree();
    running=true;
    lastT=0;
    requestAnimationFrame(step);

    await new Promise(r=>setTimeout(r, 520));
    await typeText(MESSAGE, CFG.TYPING_SPEED);
    typedDone = true;
    tryReveal();
  }

  btnStart.addEventListener("click", async ()=>{
    console.log("▶️ Click en INICIAR detectado");
    intro.style.display="none";
    await startSequence();
  });

  btnSurprise.addEventListener("click", ()=>{
    if(!W || !H) return;
    const cx = BLOOM_CENTER.x || (W*CFG.BLOOM_POS_X);
    const cy = BLOOM_CENTER.y || (H*CFG.BLOOM_POS_Y);
    const scale=Math.min(W,H)*0.020;
    const extra = generateHeartTargets(80, cx, cy, scale);

    for(const target of extra){
      if(heartsDock.length >= CFG.MAX_HEARTS) break;
      const sx = target.x + rand(-160,160);
      const sy = target.y + rand(60,220);
      heartsDock.push(new DockHeart(sx, sy, target));
      if(sparkles.length < CFG.MAX_SPARKLES && Math.random()<0.45){
        sparkles.push(new Sparkle(target.x, target.y));
      }
    }
  });

  btnReplay.addEventListener("click", async ()=>{
    btnSurprise.disabled=true;
    btnReplay.disabled=true;

    typedEl.textContent="";
    gallery.classList.add("hidden");

    typedDone=false; bloomDone=false; galleryShown=false;
    document.body.classList.remove("final-glow");
    hideSilhouettes();

    buildTree();
    phase="grow";

    await new Promise(r=>setTimeout(r, 320));
    await typeText(MESSAGE, CFG.TYPING_SPEED);
    typedDone=true;
    tryReveal();
  });

  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden){
      running=false;
    }else{
      if(!running){
        running=true;
        lastT=0;
        requestAnimationFrame(step);
      }
    }
  });
}




