// ── TELEGRAM ──
const tg=window.Telegram?.WebApp;
if(tg){tg.ready();tg.expand()}

// ── WEB MODE: Telegram tashqarisida topbar ko'rsatish ──
const _isWeb = !tg || !tg.initData;
function _syncTopbar(){
  const bar = document.getElementById('webTopbar');
  if(!bar) return;
  bar.style.display = (_isWeb && window.innerWidth < 900) ? 'flex' : 'none';
}
_syncTopbar();
window.addEventListener('resize', _syncTopbar);

// ── PWA SERVICE WORKER ──
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

// ═══════════════════════════════════════════════════════════════
// APPLICATION STATE — Barcha dinamik ma'lumot bir joyda
// ═══════════════════════════════════════════════════════════════
const STATE = {
  // API ma'lumotlari
  CBU:        {},     // CBU rasmiy kurslar { USD:{rate,diff}, EUR:..., ... }
  CRYPTO:     {},     // Kripto narxlar  { BTC:{price,change_24h}, ... }
  METALS:     {},     // Metallar        { Gold:float, Silver:float }
  BANK_RATES: {},     // bank.uz tijorat kurslar

  // Hisob-kitob
  USD_UZS: 12500,

  // Foydalanuvchi sozlamalari (localStorage dan yuklangan)
  METAL_UNIT: localStorage.getItem('bn_unit')  || 'oz',
  LANG:       localStorage.getItem('bn_lang')  || 'uz',
  THEME:      localStorage.getItem('bn_theme') || (tg?.colorScheme) || 'dark',
  BANK_CUR:   localStorage.getItem('bn_cur')   || 'USD',

  // UI holati
  bankSort:    '',
  cbuExpanded: false,

  // Telegram tugma handlerlari
  _mbHandler: null,
  _bbHandler: null,
};
// ═══════════════════════════════════════════════════════════════


// ── HAPTIC ──
function haptic(type='impact',style='light'){
  if(!tg?.HapticFeedback) return;
  if(type==='impact') tg.HapticFeedback.impactOccurred(style);
  else if(type==='notify') tg.HapticFeedback.notificationOccurred(style);
  else if(type==='select') tg.HapticFeedback.selectionChanged();
}

// ── MAIN / BACK BUTTON ──

function updateMainButton(tab){
  if(!tg?.MainButton) return;
  const mb=tg.MainButton;
  if(STATE._mbHandler){mb.offClick(STATE._mbHandler);STATE._mbHandler=null;}
  if(tab===2){
    mb.setParams({text:'📋 Natijani nusxalash',color:'#d4a843',text_color:'#000000'});
    mb.show();
    STATE._mbHandler=()=>{haptic('notify','success');copyResult();};
    mb.onClick(STATE._mbHandler);
  }else if(tab===4){
    mb.setParams({text:'＋ Aktiv qo\'shish',color:'#d4a843',text_color:'#000000'});
    mb.show();
    STATE._mbHandler=()=>{haptic('impact','medium');togglePortForm();};
    mb.onClick(STATE._mbHandler);
  }else{
    mb.hide();
  }
}

let _uiBackFn=null;
function _uiBack(){if(_uiBackFn)_uiBackFn();}
function showBackButton(handler){
  _uiBackFn=handler;
  const b=document.getElementById('uiBackBtn');
  if(b) b.style.display='flex';
  if(!tg?.BackButton) return;
  if(STATE._bbHandler){tg.BackButton.offClick(STATE._bbHandler);STATE._bbHandler=null;}
  STATE._bbHandler=handler;
  tg.BackButton.onClick(STATE._bbHandler);
  tg.BackButton.show();
}

function hideBackButton(){
  _uiBackFn=null;
  const b=document.getElementById('uiBackBtn');
  if(b) b.style.display='none';
  if(!tg?.BackButton) return;
  if(STATE._bbHandler){tg.BackButton.offClick(STATE._bbHandler);STATE._bbHandler=null;}
  tg.BackButton.hide();
}

// ── STATE ──

// ── I18N ──
const I18N={
  uz:{sub:"Bozor Ma'lumotlari",t0:"Valyuta",t1:"Kripto",t2:"Kalkulyator",t3:"Metallar",
    loading:"Yuklanmoqda...",cbu_rates:"Markaziy Bank Kurslari",bank_rates:"Tijorat Banklari",
    crypto_usd:"Kripto — USD",crypto_uzs:"So'm da Narxlar",metals_title:"Qimmatbaho Metallar",
    metals_uzs:"So'm da Narxlar",amount:"Miqdor",select_cur:"Valyuta tanlang",
    calc_btn:"Hisoblash",result:"Natija",err:"Internet aloqasini tekshiring",
    buy:"Sotib olish",sell:"Sotish",bank:"Bank",per_gram:"1 g",
    chart_title:"30 Kunlik Kurs Grafigi",chart_empty:"Grafik uchun ma'lumot to'planmoqda...",
    sub_desc:"Har kuni 09:45 va 18:00 da kurslar botga avtomatik yuboriladi. Narx o'zgarganda ogohlantirish ham o'rnating!"},
  ru:{sub:"Рыночные Данные",t0:"Валюта",t1:"Крипто",t2:"Калькулятор",t3:"Металлы",
    loading:"Загрузка...",cbu_rates:"Курсы ЦБ",bank_rates:"Коммерческие Банки",
    crypto_usd:"Крипто — USD",crypto_uzs:"Цены в Сумах",metals_title:"Драг. Металлы",
    metals_uzs:"Цены в Сумах",amount:"Сумма",select_cur:"Выберите валюту",
    calc_btn:"Рассчитать",result:"Результат",err:"Проверьте интернет",
    buy:"Покупка",sell:"Продажа",bank:"Банк",per_gram:"1 г",
    chart_title:"График курса за 30 дней",chart_empty:"Данные для графика накапливаются...",
    sub_desc:"Каждый день в 09:45 и 18:00 курсы отправляются в бот. Настройте оповещения о ценах!",soz_title:"Настройки",soz_sub:"Язык, вид и уведомления",soz_premium:"Перейти на Premium",soz_premium_sub:"Безлимитные функции и AI анализ",soz_account:"Аккаунт",soz_lang_lbl:"Язык интерфейса",soz_theme_sec:"Вид",soz_theme:"Тема",soz_notif:"Уведомления",soz_daily:"Ежедневные курсы",soz_daily_sub:"Каждый день 09:45 и 18:00",soz_alerts:"Ценовые оповещения",soz_alerts_sub:"Уведомление при достижении порога",soz_about:"О приложении",soz_channel:"Официальный канал",soz_version:"Версия"},
  en:{sub:"Market Intelligence",t0:"Currency",t1:"Crypto",t2:"Calculator",t3:"Metals",
    loading:"Loading...",cbu_rates:"Central Bank Rates",bank_rates:"Commercial Banks",
    crypto_usd:"Crypto — USD",crypto_uzs:"Prices in UZS",metals_title:"Precious Metals",
    metals_uzs:"Prices in UZS",amount:"Amount",select_cur:"Select currency",
    calc_btn:"Calculate",result:"Result",err:"Check your internet",
    buy:"Buy",sell:"Sell",bank:"Bank",per_gram:"1 g",
    chart_title:"30-Day Rate Chart",chart_empty:"Chart data is being collected...",
    sub_desc:"Rates are sent automatically at 09:45 and 18:00. Set price alerts too!",soz_title:"Settings",soz_sub:"Language, appearance & notifications",soz_premium:"Upgrade to Premium",soz_premium_sub:"Unlimited features & AI analysis",soz_account:"Account",soz_lang_lbl:"Interface Language",soz_theme_sec:"Appearance",soz_theme:"Theme",soz_notif:"Notifications",soz_daily:"Daily Rate Updates",soz_daily_sub:"Every day at 09:45 and 18:00",soz_alerts:"Price Alerts",soz_alerts_sub:"Notify when threshold reached",soz_about:"About",soz_channel:"Official Channel",soz_version:"Version"},
};
const tx=k=>(I18N[STATE.LANG]||I18N.uz)[k]||k;
const LANG_LABELS={uz:"O'zbekcha",uz_cyr:'Ўзбекча',qqp:'Qaraqalpaqsha',en:'English',ru:'Русский'};
const LANG_CODES=['uz','uz_cyr','qqp','en','ru'];
function applyLang(){
  document.querySelectorAll('[data-i]').forEach(e=>{e.textContent=tx(e.dataset.i)});
  document.documentElement.lang=STATE.LANG;
  const lv=LANG_LABELS[STATE.LANG]||LANG_LABELS.uz;
  const lbl=document.getElementById('sozLangLbl');if(lbl)lbl.textContent=lv;
  const val=document.getElementById('sozLangVal');if(val)val.textContent=lv;
}
function setLang(l){
  haptic('select');
  STATE.LANG=l;localStorage.setItem('bn_lang',l);applyLang();
  if(Object.keys(STATE.CBU).length)renderCBU();
  if(Object.keys(STATE.CRYPTO).length)renderCrypto();
  if(Object.keys(STATE.METALS).length)renderMetals();
  if(Object.keys(STATE.BANK_RATES).length)renderBankTable();
  // Grafik bo'sh xabari til bilan yangilansin
  const cw=document.getElementById('chartWrap');
  if(cw&&chartHistory.length<2)cw.innerHTML=`<div class="chart-empty">${tx('chart_empty')}</div>`;
  updateChartSummary();
}

// ── STATE.THEME ──
const THEME_LABELS={system:'Tizimli',light:'Yorqin',dark:'Qorong\'i'};
const THEME_ICONS_SVG={
  system:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/><path d="M12 7a5 5 0 0 1 0 10V7z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="5"/></svg>`,
  light:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
  dark:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
};
function getEffectiveTheme(){
  if(STATE.THEME==='system')
    return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  return STATE.THEME;
}
function applyTheme(){
  const eff=getEffectiveTheme();
  document.body.dataset.theme=eff;
  document.getElementById('themeSvg').innerHTML=eff==='dark'
    ?'<path d="M17 12.5A7 7 0 0 1 7.5 3a7 7 0 1 0 9.5 9.5z"/>'
    :'<circle cx="10" cy="10" r="4"/><line x1="10" y1="1" x2="10" y2="3"/><line x1="10" y1="17" x2="10" y2="19"/><line x1="1" y1="10" x2="3" y2="10"/><line x1="17" y1="10" x2="19" y2="10"/><line x1="3.5" y1="3.5" x2="5" y2="5"/><line x1="15" y1="15" x2="16.5" y2="16.5"/><line x1="16.5" y1="3.5" x2="15" y2="5"/><line x1="5" y1="15" x2="3.5" y2="16.5"/>';
  if(tg){tg.setHeaderColor(eff==='dark'?'#090e1c':'#f5f7fc');tg.setBackgroundColor(eff==='dark'?'#090e1c':'#f5f7fc')}
  const lv=THEME_LABELS[STATE.THEME]||THEME_LABELS.dark;
  const lbl=document.getElementById('sozThemeLbl');if(lbl)lbl.textContent=lv;
  const val=document.getElementById('sozThemeVal');if(val)val.textContent=lv;
  const ico=document.getElementById('sozThemeIco');if(ico)ico.innerHTML=THEME_ICONS_SVG[STATE.THEME]||THEME_ICONS_SVG.dark;
}
function toggleTheme(){
  haptic('impact','medium');
  STATE.THEME=STATE.THEME==='dark'?'light':'dark';
  localStorage.setItem('bn_theme',STATE.THEME);
  localStorage.setItem('bn_theme_manual','1');
  applyTheme();
}
// ── THEME SHEET ──
function openThemeSheet(){
  haptic('impact','light');
  document.getElementById('themeSheetOverlay').classList.add('open');
  document.getElementById('themeSheet').classList.add('open');
  updateThemeRadios();
}
function closeThemeSheet(){
  document.getElementById('themeSheetOverlay').classList.remove('open');
  document.getElementById('themeSheet').classList.remove('open');
}
function updateThemeRadios(){
  ['system','light','dark'].forEach(t=>{
    const el=document.getElementById('trad-'+t);
    if(el)el.classList.toggle('on',STATE.THEME===t);
  });
}
function setThemeOption(t){
  haptic('impact','light');
  STATE.THEME=t;
  localStorage.setItem('bn_theme',t);
  if(t==='system'){localStorage.removeItem('bn_theme_manual');}
  else{localStorage.setItem('bn_theme_manual','1');}
  updateThemeRadios();
  applyTheme();
  setTimeout(closeThemeSheet,260);
}
applyTheme();

// ── CLOCK ──
const clkEl=document.getElementById('clk');
const tickClk=()=>clkEl.textContent=new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
tickClk();setInterval(tickClk,1000);

// ── TABS ──
const MKT_TABS=[0,1,3,4]; // Valyuta, Kripto, Portfel, Metallar
function goTab(i){
  haptic('select');
  document.querySelectorAll('.sec').forEach((s,j)=>s.classList.toggle('on',j===i));
  document.querySelectorAll('.tab').forEach((t,j)=>t.classList.toggle('on',j===i));
  // Bottom nav highlight
  document.querySelectorAll('.nb').forEach(n=>{
    const t=parseInt(n.dataset.tab??'-1');
    // Valyuta nav button stays highlighted for all market sub-tabs
    const isValy=t===0&&MKT_TABS.includes(i);
    n.classList.toggle('on',t===i||isValy);
  });

  hideBackButton();
  updateMainButton(i);
  if(i===2) doCalc();
  if(i===3) renderPortfolio();
  if(i===5) renderProfileTab();
  if(i===6) renderAITahlil();
  if(i===7) renderSozlamalar();
}

// ── DATA REFS ──
const FL={USD:'us',EUR:'eu',RUB:'ru',GBP:'gb',CNY:'cn',KZT:'kz',TRY:'tr',JPY:'jp',CHF:'ch',UZS:'uz'};
const NM={
  uz:{USD:'AQSH dollari',EUR:'Evro',RUB:'Rossiya rubli',GBP:'Britaniya funti',CNY:'Xitoy yuani',KZT:'Qozog\'iston tengesi',TRY:'Turk lirasi',JPY:'Yaponiya iyenasi',CHF:'Shveytsariya franki'},
  ru:{USD:'Доллар США',EUR:'Евро',RUB:'Рубль',GBP:'Фунт стерлингов',CNY:'Китайский юань',KZT:'Тенге',TRY:'Турецкая лира',JPY:'Йена',CHF:'Швейцарский франк'},
  en:{USD:'US Dollar',EUR:'Euro',RUB:'Russian Ruble',GBP:'British Pound',CNY:'Chinese Yuan',KZT:'Kazakhstani Tenge',TRY:'Turkish Lira',JPY:'Japanese Yen',CHF:'Swiss Franc'},
};
// CoinGecko rasmiy logo URL lari
const CLOGO={
  BTC:'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH:'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  TON:'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
  BNB:'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  SOL:'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDT:'https://assets.coingecko.com/coins/images/325/small/Tether.png',
};
// Metal SVG logolar (inline, hech qanday tashqi URL kerak emas)
const MLOGO={
  XAU:`<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="au" cx="35%" cy="30%"><stop stop-color="#FFE566"/><stop offset="1" stop-color="#A87010"/></radialGradient></defs><circle cx="20" cy="20" r="20" fill="url(#au)"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#5a3200" font-family="serif">Au</text></svg>`,
  XAG:`<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="ag" cx="35%" cy="30%"><stop stop-color="#eef2f8"/><stop offset="1" stop-color="#7a8a9a"/></radialGradient></defs><circle cx="20" cy="20" r="20" fill="url(#ag)"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#2a3a4a" font-family="serif">Ag</text></svg>`,
  XPT:`<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="pt" cx="35%" cy="30%"><stop stop-color="#d8eaf8"/><stop offset="1" stop-color="#506070"/></radialGradient></defs><circle cx="20" cy="20" r="20" fill="url(#pt)"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#102030" font-family="serif">Pt</text></svg>`,
  XPD:`<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="pd" cx="35%" cy="30%"><stop stop-color="#ead8ea"/><stop offset="1" stop-color="#705870"/></radialGradient></defs><circle cx="20" cy="20" r="20" fill="url(#pd)"/><text x="20" y="25" text-anchor="middle" font-size="14" font-weight="bold" fill="#301030" font-family="serif">Pd</text></svg>`,
};
const CID={bitcoin:'BTC',ethereum:'ETH','the-open-network':'TON',binancecoin:'BNB',solana:'SOL',tether:'USDT'};
const MID={'pax-gold':'XAU','silver':'XAG','platinum':'XPT','palladium':'XPD'};
const MDATA={XAU:{cls:'g'},XAG:{cls:'s'},XPT:{cls:'p'},XPD:{cls:'pd'}};
const MNAME={
  uz:{XAU:'Oltin',XAG:'Kumush',XPT:'Platina',XPD:'Palladiy'},
  ru:{XAU:'Золото',XAG:'Серебро',XPT:'Платина',XPD:'Палладий'},
  en:{XAU:'Gold',XAG:'Silver',XPT:'Platinum',XPD:'Palladium'},
};


function fmt(v,d=0){
  if(v===null||v===undefined)return'—';
  if(v>=1e9)return(v/1e9).toFixed(2)+'B';
  if(v>=1e6)return(v/1e6).toFixed(2)+'M';
  return v.toLocaleString('uz-UZ',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtFull(v,d=0){
  if(v===null||v===undefined)return'—';
  return v.toLocaleString('uz-UZ',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtBig(v){
  if(!v&&v!==0)return'—';
  if(v>=1e12)return'$'+(v/1e12).toFixed(2)+'T';
  if(v>=1e9)return'$'+(v/1e9).toFixed(2)+'B';
  if(v>=1e6)return'$'+(v/1e6).toFixed(2)+'M';
  return'$'+v.toLocaleString();
}
const cl=v=>v>0?'up':v<0?'dn':'nt';
const ar=v=>v>0?'▲':v<0?'▼':'—';
const cname=c=>(NM[STATE.LANG]||NM.uz)[c]||c;
const mname=s=>(MNAME[STATE.LANG]||MNAME.uz)[s]||s;

// ── API ──
const BANKS_URL = 'https://raw.githubusercontent.com/sherzodbekhome/bankNews-app/main/backend/banks_data.json';


// bank.uz HTML ni brauzerda parse qilish (fetch_banks.py dagi Python logikasi JS da)
function parseBankUzHTML(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const result={};
  for(const [cid,cur] of [['best_USD','USD'],['best_RUB','RUB'],['best_EUR','EUR']]){
    const sec=doc.getElementById(cid);
    if(!sec) continue;
    const extract=side=>{
      const res={};
      if(!side) return res;
      for(const block of side.querySelectorAll('.bc-inner-block-left-texts')){
        const name=block.querySelector('.medium-text')?.textContent?.trim();
        const raw=block.querySelector('.green-date')?.textContent?.trim()||'';
        const m=raw.match(/(\d[\d\s]{0,8})(?:[.,]\d+)?\s*so/i);
        if(!m||!name) continue;
        const v=parseInt(m[1].replace(/\s/g,''));
        if(v>=50&&v<=500000) res[name]=v;
      }
      return res;
    };
    const buys=extract(sec.querySelector('.bc-inner-blocks-left'));
    const sells=extract(sec.querySelector('.bc-inner-blocks-right'));
    const names=new Set([...Object.keys(buys),...Object.keys(sells)]);
    const banks=[];
    for(const name of names){
      const buy=buys[name]||0,sell=sells[name]||0;
      if(buy||sell) banks.push({name,buy,sell,spread:(buy&&sell)?sell-buy:0});
    }
    if(banks.length) result[cur]=banks.sort((a,b)=>b.buy-a.buy);
  }
  return Object.keys(result).length>=2?result:null;
}


// Bank kurslarini yuklash: 3 qavatli tizim (grafik ham shu yerda — bitta fetch)
async function loadBankRates(){
  // 1. GitHub raw (GitHub Actions har soat yangilaydi — eng ishonchli)
  try{
    const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),7000);
    const r=await fetch(BANKS_URL,{cache:'no-cache',signal:ac.signal});
    clearTimeout(tid);
    if(r.ok){
      const d=await r.json();
      if(d.ok&&d.data&&Object.keys(d.data).length){
        STATE.BANK_RATES=d.data;
        // Grafik tarixi ham shu JSON dan — ikkinchi fetch kerak emas
        chartHistory=d.history||[];
        if(d.updated){
          const t=new Date(d.updated);
          const ts=t.toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'})+' yangilandi';
          const upd=document.getElementById('bankListUpdated');
          if(upd) upd.textContent=ts;
        }
        renderChartFromHistory();
        // Sparkline lar yangi history bilan yangilansin
        if(Object.keys(STATE.CBU).length) renderCBU();
        return;
      }
    }
  }catch(_){}

  // 2. bank.uz to'g'ridan — CORS proxy orqali (fayl yo'q bo'lganda real vaqt ma'lumoti)
  try{
    const ac=new AbortController();
    const tid=setTimeout(()=>ac.abort(),7000);
    const r=await fetch(
      'https://corsproxy.io/?url='+encodeURIComponent('https://bank.uz/uz/currency'),
      {cache:'no-cache',signal:ac.signal}
    );
    clearTimeout(tid);
    if(r.ok){
      const html=await r.text();
      const data=parseBankUzHTML(html);
      if(data){
        STATE.BANK_RATES=data;
        return;
      }
    }
  }catch(_){}

  // Ikki manba ham ishlamadi
}

// ── STATE.CBU ──
async function loadCBU(){
  // 1. STATE.CBU ni alohida try-catch — muvaffaqiyatsiz bo'lsa ham bank kurslari yuklansin
  try{
    let rates={};
    const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),8000);
    const r=await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/',{signal:ac.signal});
    clearTimeout(tid);
    const d=await r.json();
    ['USD','EUR','RUB','GBP','CNY','KZT','TRY','JPY','CHF'].forEach(c=>{
      const f=d.find(x=>x.Ccy===c);
      if(f){
        const rate=+f.Rate, diff=+(f.Diff||0);
        const diff_pct=rate>0?Math.round((diff/rate)*10000)/100:0;
        rates[c]={rate,diff,diff_pct};
      }
    });
    STATE.CBU=rates;
    if(STATE.CBU.USD){
      STATE.USD_UZS=STATE.CBU.USD.rate;
      // Metallar parallel yuklangan bo'lsa — UZS ni qayta hisoblash
      Object.keys(STATE.METALS).forEach(s=>{
        if(STATE.METALS[s]){STATE.METALS[s].uzs=STATE.METALS[s].usd*STATE.USD_UZS;STATE.METALS[s].gram=(STATE.METALS[s].usd/31.1035);}
      });
      if(Object.keys(STATE.METALS).length) renderMetalsGrid();
      // Kripto parallel yuklangan bo'lsa — UZS ni qayta hisoblash (Fix #2)
      Object.keys(STATE.CRYPTO).forEach(s=>{if(STATE.CRYPTO[s]) STATE.CRYPTO[s].uzs=STATE.CRYPTO[s].usd*STATE.USD_UZS;});
      if(Object.keys(STATE.CRYPTO).length) renderCrypto();
    }
  }catch(_){
    // STATE.CBU muvaffaqiyatsiz — bank kurslari va grafik baribir yuklanadi
  }
  // 2. Bank kurslari har doim yuklanadi — STATE.CBU muvaffaqiyatidan qat'i nazar (Fix #1)
  await loadBankRates();
  if(Object.keys(STATE.CBU).length){
    renderCBU();
  }else{
    document.getElementById('v-load').style.display='none';
    document.getElementById('v-body').style.display='block';
    document.getElementById('cbuList').innerHTML=`<div class="ltxt" style="padding:12px 15px">⚠️ Markaziy bank ma'lumotlari yuklanmadi</div>`;
    renderBankTable();
  }
}


function _sparklineSVG(cur,fullWidth=false){
  const VW=100,VH=fullWidth?28:26,pad=2;
  const pts=chartHistory.filter(h=>h[cur]!=null).map(h=>h[cur]).slice(-7);
  if(pts.length<3) return fullWidth?'':`<div style="width:60px"></div>`;
  const mn=Math.min(...pts),mx=Math.max(...pts);
  const range=mx-mn||1;
  const coords=pts.map((v,i)=>{
    const x=pad+(i/(pts.length-1))*(VW-pad*2);
    const y=VH-pad-((v-mn)/range)*(VH-pad*2);
    return`${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const isUp=pts[pts.length-1]>=pts[0];
  const col=isUp?'var(--green)':'var(--red)';
  const last=coords.split(' ').pop().split(',');
  const lx=parseFloat(last[0]),ly=parseFloat(last[1]);

  if(fullWidth){
    return`<svg width="100%" height="${VH}" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" style="display:block;overflow:visible">
      <defs><linearGradient id="spkf${cur}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${col}" stop-opacity=".3"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="${coords} ${(VW-pad).toFixed(1)},${VH} ${pad},${VH}" fill="url(#spkf${cur})"/>
      <polyline points="${coords}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  return`<svg width="60" height="${VH}" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" style="flex-shrink:0;overflow:visible">
    <defs><linearGradient id="spk${cur}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".25"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${coords} ${(VW-pad).toFixed(1)},${VH} ${pad},${VH}" fill="url(#spk${cur})"/>
    <polyline points="${coords}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.2" fill="${col}" opacity=".9"/>
  </svg>`;
}

function renderCBU(){
  document.getElementById('v-load').style.display='none';
  document.getElementById('v-body').style.display='block';

  const ACCENT={USD:'usd',EUR:'eur',RUB:'rub',GBP:'gbp',CNY:'cny',KZT:'kzt',TRY:'try',JPY:'jpy',CHF:'chf'};
  const SYM={USD:'$',EUR:'€',RUB:'₽',GBP:'£',CNY:'¥',KZT:'₸',TRY:'₺',JPY:'¥',CHF:'₣'};
  const all=Object.entries(STATE.CBU);

  function badge(diff2,pct){
    const cl=diff2>0?'up':diff2<0?'dn':'nt';
    const ar=diff2>0?'▲':diff2<0?'▼':'';
    return `<div class="cbu-card-pct ${cl}">${ar}${pct}</div>`;
  }
  function diffRow(diff2,cls){
    const t=diff2!==0?`${diff2>0?'+':'-'} ${Math.abs(diff2).toFixed(2)} so'm`:'—';
    return `<div class="cbu-hero-diff ${cls}">${t}</div>`;
  }

  // ── HERO karta (USD) ──────────────────────────────────────
  const heroEntry=all.find(([c])=>c==='USD');
  let heroHTML='';
  if(heroEntry){
    const [c,i]=heroEntry;
    const diff2=i.diff||0;
    const pct=i.diff_pct!=null?`${i.diff_pct>0?'+':''}${Number(i.diff_pct).toFixed(2)}%`:'—';
    const cl2=diff2>0?'up':diff2<0?'dn':'nt';
    const spk=_sparklineSVG(c,false);
    heroHTML=`<div class="cbu-hero-card ${ACCENT[c]||''}" data-sym="${SYM[c]||''}" onclick="sendToCalc('${c}')">
      <div class="cbu-hero-top">
        <div class="cbu-hero-flag">${_flagImg(c,36,24)}<span class="cbu-hero-code">${c}</span></div>
        ${badge(diff2,pct)}
      </div>
      <div class="cbu-hero-name">${cname(c)} · CBU rasmiy kursi</div>
      <div class="cbu-hero-rate">${fmtFull(i.rate,0)}<span class="cbu-hero-unit">so'm</span></div>
      ${diffRow(diff2,cl2)}
      ${spk?`<div class="cbu-hero-spk">${spk}</div>`:''}
    </div>`;
  }

  // ── Qolgan valyutalar grid ─────────────────────────────────
  function cbuCard([c,i]){
    const diff2=i.diff||0;
    const pct=i.diff_pct!=null?`${i.diff_pct>0?'+':''}${Number(i.diff_pct).toFixed(2)}%`:'—';
    const cl2=diff2>0?'up':diff2<0?'dn':'nt';
    const spk=_sparklineSVG(c,true);
    return`<div class="cbu-card ${ACCENT[c]||''}" data-sym="${SYM[c]||''}" onclick="sendToCalc('${c}')">
      <div class="cbu-flag-row">
        <div class="cbu-flag-ico">${_flagImg(c,26,17)}<span style="font-size:9px;font-weight:800;color:var(--ac);margin-left:4px">${c}</span></div>
        ${badge(diff2,pct)}
      </div>
      <div class="cbu-card-name">${cname(c)}</div>
      ${spk?`<div class="cbu-card-spk">${spk}</div>`:''}
      <div class="cbu-card-rate">${fmtFull(i.rate,i.rate<10?4:i.rate<1000?2:0)}<small>so'm</small></div>
      <div class="cbu-card-diff ${cl2}">${diff2!==0?`${diff2>0?'+':'-'}${Math.abs(diff2).toFixed(2)}`:'—'}</div>
    </div>`;
  }

  const rest=all.filter(([c])=>c!=='USD');
  const grid=`<div class="cbu-grid">${rest.map(cbuCard).join('')}</div>`;
  document.getElementById('cbuList').innerHTML=heroHTML+grid;
  renderBankTable();
  saveCache();
}
function setBankCur(cur,btn){
  haptic('select');
  STATE.BANK_CUR=cur;
  localStorage.setItem('bn_cur',cur);
  document.querySelectorAll('.stab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  STATE.bankSort='';
  document.getElementById('bsort-buy')?.classList.remove('on');
  document.getElementById('bsort-sell')?.classList.remove('on');
  renderBankTable();
}

function setBankSort(dir){
  haptic('impact','light');
  STATE.bankSort = STATE.bankSort===dir ? '' : dir;
  const buyBtn=document.getElementById('bsort-buy');
  const sellBtn=document.getElementById('bsort-sell');
  buyBtn?.classList.toggle('on', STATE.bankSort==='buy');
  sellBtn?.classList.toggle('on', STATE.bankSort==='sell');
  renderBankTable();
}

function renderHeroCard(){
  const usdRows=STATE.BANK_RATES['USD']||[];
  if(!usdRows.length) return;
  const sorted=[...usdRows].sort((a,b)=>b.buy-a.buy);
  const topBuy=sorted[0];
  const topSell=[...usdRows].sort((a,b)=>a.sell-b.sell)[0];
  const bv=document.getElementById('heroBuyVal');
  const bk=document.getElementById('heroBuyBank');
  const sv=document.getElementById('heroSellVal');
  const sk=document.getElementById('heroSellBank');
  const df=document.getElementById('heroDiff');
  if(bv) bv.textContent=fmtFull(topBuy.buy,0);
  if(bk) bk.textContent=topBuy.name;
  if(sv) sv.textContent=fmtFull(topSell.sell,0);
  if(sk) sk.textContent=topSell.name;
  if(df&&STATE.CBU.USD){
    const diff=topBuy.buy-STATE.CBU.USD.rate;
    const sign=diff>=0?'+':'';
    df.innerHTML=`STATE.CBU: <span>${fmtFull(STATE.CBU.USD.rate,0)} so'm</span> · Ustama: <span style="color:${diff>=0?'var(--green)':'var(--red)'}">${sign}${fmtFull(diff,0)}</span>`;
  }
}

function renderBankTable(){
  renderHeroCard();
  const allRows=STATE.BANK_RATES[STATE.BANK_CUR]||[];
  const q=(document.getElementById('bankSearch')?.value||'').toLowerCase().trim();
  let rows=q?allRows.filter(b=>b.name.toLowerCase().includes(q)):[...allRows];
  if(STATE.bankSort==='buy') rows.sort((a,b)=>b.buy-a.buy);
  else if(STATE.bankSort==='sell') rows.sort((a,b)=>a.sell-b.sell);
  else rows.sort((a,b)=>b.buy-a.buy);
  if(!rows.length){
    document.getElementById('bankTable').innerHTML=`<div class="ltxt" style="padding:16px">⚠️ ${q?'Bank topilmadi':'Kurslar yo\'q'}</div>`;
    return;
  }
  const sorted=[...allRows];
  const topBuyBank=sorted.reduce((a,b)=>b.buy>a.buy?b:a,sorted[0]);
  const topSellBank=sorted.reduce((a,b)=>b.sell<a.sell?b:a,sorted[0]);
  const topBuy=topBuyBank.buy, topSell=topSellBank.sell;
  const dec=STATE.BANK_CUR==='RUB'?2:0;
  const cards=rows.map((b,idx)=>{
    const isBestBuy=b.buy===topBuy;
    const isBestSell=b.sell===topSell;
    const badge=isBestBuy?`<span class="brc-best">★ BUY</span>`:isBestSell?`<span class="brc-best sell">★ SELL</span>`:'';
    return`<div class="brc" onclick="openBankCalc('${b.name.replace(/'/g,"\\'")}',${b.buy},${b.sell})">
      <div class="brc-body">
        <div class="brc-top">
          <span class="brc-n">${idx+1}</span>
          <span class="brc-name">${b.name}</span>
          ${badge}
        </div>
        <div class="brc-rates">
          <div class="brc-rate-item buy"><span>Sotib olish</span><b>${fmtFull(b.buy,dec)}</b></div>
          <div class="brc-rate-div"></div>
          <div class="brc-rate-item sell"><span>Sotish</span><b>${fmtFull(b.sell,dec)}</b></div>
        </div>
      </div>
      <span class="brc-chev">›</span>
    </div>`;
  }).join('');
  document.getElementById('bankTable').innerHTML=`<div class="brc-list">${cards}</div>`;
}

// ══════════════════════════════════════════
// ── P2P BOZOR KURSI ──
// ══════════════════════════════════════════
let P2P={};
let _p2pTab='buy'; // 'buy'=user oladi (USDT sotib olish takliflari) | 'sell'=user sotadi

async function _fetchP2PSide(tradeType){
  const body=JSON.stringify({
    asset:'USDT',fiat:'UZS',merchantCheck:false,
    page:1,payTypes:[],publisherType:null,
    rows:5,side:tradeType,tradeType
  });
  const headers={'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'};

  // 1. To'g'ridan-to'g'ri urinish
  try{
    const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),5000);
    const r=await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {method:'POST',headers,body,signal:ac.signal});
    clearTimeout(tid);
    if(r.ok){const d=await r.json();if(d.data?.length) return d.data;}
  }catch(_){}

  // 2. corsproxy.io orqali
  try{
    const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),7000);
    const proxy='https://corsproxy.io/?url='+encodeURIComponent('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search');
    const r=await fetch(proxy,{method:'POST',headers,body,signal:ac.signal});
    clearTimeout(tid);
    if(r.ok){const d=await r.json();if(d.data?.length) return d.data;}
  }catch(_){}

  return null;
}

async function loadP2P(manual=false){
  const bodyEl=document.getElementById('p2pBody');
  if(manual&&bodyEl) bodyEl.innerHTML=`<div style="padding:16px;text-align:center;color:var(--text3);font-size:12px"><div style="font-size:24px;margin-bottom:6px">⏳</div>Yuklanmoqda...</div>`;

  try{
    const [buyData,sellData]=await Promise.all([
      _fetchP2PSide('BUY'),
      _fetchP2PSide('SELL')
    ]);

    if(!buyData&&!sellData){
      const lv=document.getElementById('p2pLive');
      if(lv) lv.style.display='none';
      if(bodyEl) bodyEl.innerHTML=`<div style="padding:16px;text-align:center;color:var(--text3);font-size:11px">⚠️ P2P ma'lumotlari olishda xatolik.<br>Binance P2P <a href="https://p2p.binance.com" target="_blank" style="color:var(--gold)">saytini</a> ko'ring.</div>`;
      return;
    }

    const parseOffer=item=>({
      price:parseFloat(item.adv.price)||0,
      minAmt:parseFloat(item.adv.minSingleTransAmount)||0,
      maxAmt:parseFloat(item.adv.maxSingleTransAmount)||0,
      qty:parseFloat(item.adv.tradableQuantity)||0,
      nick:item.advertiser.nickName||'—',
      orders:item.advertiser.monthOrderCount||0,
      rate:item.advertiser.monthFinishRate||0,
    });

    P2P={
      buy:buyData?buyData.map(parseOffer):[],   // Siz USDT sotib olasiz — eng arzon takliflar
      sell:sellData?sellData.map(parseOffer):[], // Siz USDT sotasiz — eng qimmat takliflar
      updated:Date.now()
    };
    renderP2P();
    saveCache();
  }catch(_){
    const lv=document.getElementById('p2pLive');
    if(lv) lv.style.display='none';
    if(bodyEl) bodyEl.innerHTML=`<div style="padding:16px;text-align:center;color:var(--text3);font-size:11px">⚠️ P2P yuklanmadi</div>`;
  }
}

function setP2PTab(tab){
  haptic('select');
  _p2pTab=tab;
  document.getElementById('p2ptab-buy')?.classList.toggle('on',tab==='buy');
  document.getElementById('p2ptab-sell')?.classList.toggle('on',tab==='sell');
  _renderP2POffers();
}

function renderP2P(){
  const el=document.getElementById('p2pBody');
  const liveEl=document.getElementById('p2pLive');
  if(!el) return;
  if(liveEl) liveEl.style.display='flex';

  if(!P2P.buy?.length&&!P2P.sell?.length){
    el.innerHTML=`<div style="padding:16px;text-align:center;color:var(--text3);font-size:11px">Takliflar yo'q</div>`;
    return;
  }

  const bestBuy=P2P.buy[0]?.price||0;   // eng arzon USDT seller (user USDT oladi)
  const bestSell=P2P.sell[0]?.price||0; // eng qimmat USDT buyer (user USDT sotadi)
  const cbuRate=STATE.CBU.USD?.rate||STATE.USD_UZS;
  const bankBestBuy=(STATE.BANK_RATES.USD||[]).reduce((a,b)=>b.buy>a?b.buy:a,0);
  const spread=bestBuy>0&&bestSell>0?bestBuy-bestSell:0;

  const diffCBU=cbuRate>0?((bestBuy-cbuRate)/cbuRate*100):0;
  const diffBank=bankBestBuy>0?((bestBuy-bankBestBuy)/bankBestBuy*100):0;

  const fmtDiff=(pct)=>{
    const up=pct>=0;
    return`<span style="color:${up?'var(--green)':'var(--red)'}">
      ${up?'▲':'▼'} ${Math.abs(pct).toFixed(2)}%</span>`;
  };

  el.innerHTML=`
    <div class="p2p-grid">
      <div class="p2p-side buy">
        <div class="p2p-side-lbl">💚 Siz olasiz</div>
        <div class="p2p-price">${bestBuy>0?fmtFull(bestBuy,0):'—'}</div>
        <div class="p2p-sub">so'm / USDT</div>
        <div style="font-size:9px;color:var(--text3);margin-top:3px">eng arzon taklif</div>
      </div>
      <div class="p2p-side sell">
        <div class="p2p-side-lbl">🔴 Siz sotasiz</div>
        <div class="p2p-price">${bestSell>0?fmtFull(bestSell,0):'—'}</div>
        <div class="p2p-sub">so'm / USDT</div>
        <div style="font-size:9px;color:var(--text3);margin-top:3px">eng yuqori taklif</div>
      </div>
    </div>
    <div class="p2p-diff-bar">
      <div class="p2p-diff-item">
        <span class="p2p-diff-lbl">Spread</span>
        <span class="p2p-diff-val" style="color:var(--text2)">${spread>0?fmtFull(spread,0)+' so\'m':'—'}</span>
      </div>
      <div class="p2p-diff-item">
        <span class="p2p-diff-lbl">STATE.CBU farqi</span>
        <span class="p2p-diff-val">${cbuRate>0?fmtDiff(diffCBU):'—'}</span>
      </div>
      <div class="p2p-diff-item">
        <span class="p2p-diff-lbl">Bank farqi</span>
        <span class="p2p-diff-val">${bankBestBuy>0?fmtDiff(diffBank):'—'}</span>
      </div>
    </div>
    <div class="p2p-tab-row">
      <button id="p2ptab-buy" class="p2p-tab buy on" onclick="setP2PTab('buy')">
        💚 Siz olasiz · ${P2P.buy.length} taklif
      </button>
      <button id="p2ptab-sell" class="p2p-tab sell" onclick="setP2PTab('sell')">
        🔴 Siz sotasiz · ${P2P.sell.length} taklif
      </button>
    </div>
    <div class="p2p-offers" id="p2pOffers"></div>`;

  _renderP2POffers();
}

function _renderP2POffers(){
  const el=document.getElementById('p2pOffers');
  if(!el) return;
  const offers=_p2pTab==='buy'?P2P.buy:P2P.sell;
  if(!offers?.length){el.innerHTML='';return;}
  const isBuy=_p2pTab==='buy';

  el.innerHTML=`<div class="p2p-offers-lbl">${isBuy?'Eng arzon USDT sellерlar (siz sotib olasiz)':'Eng yuqori USDT buyerlar (siz sotasiz)'}</div>`
    +offers.map((o,i)=>{
      const url=`https://p2p.binance.com/trade/${isBuy?'buy':'sell'}/USDT?fiat=UZS`;
      const minK=o.minAmt>=1000000?(o.minAmt/1000000).toFixed(1)+'M':(o.minAmt/1000).toFixed(0)+'K';
      const maxK=o.maxAmt>=1000000?(o.maxAmt/1000000).toFixed(1)+'M':(o.maxAmt/1000).toFixed(0)+'K';
      return`<div class="p2p-row" onclick="window.open('${url}','_blank');haptic('impact','light')">
        <div style="font-size:18px;width:30px;text-align:center;flex-shrink:0">${i===0?'⭐':'👤'}</div>
        <div class="p2p-trader">
          <div class="p2p-trader-name">${o.nick}</div>
          <div class="p2p-trader-stat">${o.orders} ta savdo · ${(o.rate*100).toFixed(1)}% bajarilgan</div>
        </div>
        <div>
          <div class="p2p-row-price" style="color:${isBuy?'var(--green)':'var(--red)'}">${fmtFull(o.price,0)}</div>
          <div class="p2p-row-limit">${minK} – ${maxK} UZS</div>
        </div>
        <div class="p2p-row-arr">↗</div>
      </div>`;
    }).join('');
}

// ── STATE.CRYPTO ──
async function loadCrypto(){
  try{
    let crypto={};

    // 1. CoinGecko coins/markets — top 50, rank + logo + narx hammasi birda
    try{
      const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),9000);
      const r=await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h',
        {signal:ac.signal}
      );
      clearTimeout(tid);
      if(r.ok){
        const arr=await r.json();
        if(Array.isArray(arr)&&arr.length>10){
          arr.forEach(c=>{
            const sym=c.symbol.toUpperCase();
            crypto[sym]={
              rank:c.market_cap_rank||999,
              name:c.name,
              image:c.image,
              cgId:c.id,
              market_cap:c.market_cap,
              volume:c.total_volume,
              supply:c.circulating_supply,
              ath:c.ath,
              usd:c.current_price||0,
              change:c.price_change_percentage_24h||0,
              uzs:(c.current_price||0)*STATE.USD_UZS
            };
          });
        }
      }
    }catch(_){}

    // 2. Fallback: Binance — agar CoinGecko ishlamasa
    if(Object.keys(crypto).length<5){
      const PAIRS={BTC:'BTCUSDT',ETH:'ETHUSDT',BNB:'BNBUSDT',SOL:'SOLUSDT',TON:'TONUSDT'};
      try{
        const _ac=new AbortController(),_tid=setTimeout(()=>_ac.abort(),6000);
        const r=await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(Object.values(PAIRS)))}`,
          {signal:_ac.signal}
        );
        clearTimeout(_tid);
        const arr=await r.json();
        if(Array.isArray(arr)) arr.forEach(t=>{
          const sym=Object.keys(PAIRS).find(k=>PAIRS[k]===t.symbol);
          if(sym){const usd=parseFloat(t.lastPrice)||0,chg=parseFloat(t.priceChangePercent)||0;
            if(usd>0) crypto[sym]={rank:999,name:sym,image:CLOGO[sym]||'',usd,change:chg,uzs:usd*STATE.USD_UZS};}
        });
      }catch(_){}
      if(!crypto.USDT) crypto.USDT={rank:3,name:'Tether',image:CLOGO.USDT||'',usd:1.0,change:0.01,uzs:STATE.USD_UZS};
    }

    if(Object.keys(crypto).length<2) throw new Error('all sources failed');
    STATE.CRYPTO=crypto;
    renderCrypto();
  }catch(e){
    document.getElementById('c-load').innerHTML=`<div class="ltxt">❌ ${tx('err')}</div>`;
  }
}
function renderCrypto(){
  document.getElementById('c-load').style.display='none';
  document.getElementById('c-body').style.display='block';
  const q=(document.getElementById('csearchInput')?.value||'').toLowerCase().trim();
  const entries=Object.entries(STATE.CRYPTO)
    .filter(([sym,d])=>!q||sym.toLowerCase().includes(q)||(d.name||'').toLowerCase().includes(q))
    .sort((a,b)=>(a[1].rank||999)-(b[1].rank||999));
  document.getElementById('cgrid').innerHTML=entries.map(([sym,d])=>{
    const usd=d.usd||0;
    const p=usd>=1000?'$'+fmt(usd,0):usd>=1?'$'+fmt(usd,2):usd>=0.01?'$'+usd.toFixed(4):'$'+usd.toFixed(6);
    const chg=d.change||0;
    const logo=d.image?`<img src="${d.image}" alt="${sym}" loading="lazy" onerror="this.style.display='none'">`:sym.slice(0,3);
    return`<div class="citem" onclick="openCryptoDetail('${sym}')" style="cursor:pointer">
      <span class="crank">${d.rank<100?d.rank:''}</span>
      <div class="cico-s">${logo}</div>
      <div class="cname-b">
        <div class="cname-full">${d.name||sym}</div>
        <div class="csym-lbl">${sym}</div>
      </div>
      <div class="cprice-b">
        <div class="cprice-val">${p}</div>
        <div class="cpct ${cl(chg)}">${ar(chg)} ${Math.abs(chg).toFixed(2)}%</div>
      </div>
    </div>`;
  }).join('')||`<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">Topilmadi</div>`;
}

// ── STATE.CRYPTO DETAIL ──
let _cdCoin=null;

function openCryptoDetail(sym){
  haptic('select');
  const d=STATE.CRYPTO[sym];
  if(!d) return;
  _cdCoin=sym;

  // Header
  document.getElementById('cdLogo').innerHTML=d.image
    ?`<img src="${d.image}" alt="${sym}" style="width:100%;height:100%;display:block;object-fit:cover;border-radius:50%">`
    :sym.slice(0,3);
  document.getElementById('cdName').textContent=d.name||sym;
  document.getElementById('cdSym').textContent=sym;

  // Narx
  const usd=d.usd||0;
  const p=usd>=1000?'$'+fmt(usd,0):usd>=1?'$'+fmt(usd,2):usd>=0.01?'$'+usd.toFixed(4):'$'+usd.toFixed(6);
  document.getElementById('cdPrice').textContent=p;
  const chg=d.change||0;
  document.getElementById('cdChange').innerHTML=
    `<span style="color:${chg>=0?'var(--green)':'var(--red)'};font-weight:700">${ar(chg)} ${Math.abs(chg).toFixed(2)}%</span>`+
    `<span style="color:var(--text3);margin-left:6px">so'nggi 24 soat</span>`;

  // Bozor ma'lumotlari
  document.getElementById('cdMarket').innerHTML=[
    ['Bozor qiymati', fmtBig(d.market_cap)],
    ['24s hajmi',     fmtBig(d.volume)],
    ['Muomala',       d.supply?fmtBig(d.supply).replace('$','')+''+sym:'—'],
    ['ATH',           d.ath?'$'+fmt(d.ath,d.ath>=1?2:4):'—'],
  ].map(([lbl,val])=>`<div class="cd-mitem"><div class="cd-mitem-lbl">${lbl}</div><div class="cd-mitem-val">${val}</div></div>`).join('');

  // AI reset
  document.getElementById('cdAI').innerHTML=`<button onclick="loadCryptoAI()" style="width:100%;padding:13px;background:linear-gradient(135deg,#ffb300,#ff9500);border:none;border-radius:12px;color:#000;font-weight:800;font-size:13px;cursor:pointer">🤖 AI Tahlil qilish</button>`;

  // Grafik tugmalari reset
  document.querySelectorAll('.cd-rbtn').forEach((b,i)=>b.classList.toggle('on',i===0));
  document.getElementById('cdChart').innerHTML=`<div class="spinner" style="width:22px;height:22px;border-width:2px"></div>`;

  // Sheet ochish
  document.getElementById('cdOverlay').classList.add('open');
  document.getElementById('cdPanel').classList.add('open');

  // Grafikni yuklash
  loadCryptoChart(7);
}

function closeCryptoDetail(){
  haptic('select');
  document.getElementById('cdOverlay').classList.remove('open');
  document.getElementById('cdPanel').classList.remove('open');
}

async function loadCryptoChart(days, btn){
  if(btn){
    document.querySelectorAll('.cd-rbtn').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
  }
  const sym=_cdCoin;
  const d=STATE.CRYPTO[sym];
  if(!d) return;
  const cgId=d.cgId||sym.toLowerCase();
  document.getElementById('cdChart').innerHTML=`<div class="spinner" style="width:22px;height:22px;border-width:2px"></div>`;
  try{
    // OHLC endpoint — sham grafigi uchun open/high/low/close
    const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),9000);
    const r=await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/ohlc?vs_currency=usd&days=${days}`,{signal:ac.signal});
    clearTimeout(tid);
    const arr=await r.json();
    if(!Array.isArray(arr)||arr.length<2){
      document.getElementById('cdChart').innerHTML=`<div style="text-align:center;color:var(--text3);font-size:11px;padding:20px 0">Grafik mavjud emas</div>`;
      return;
    }

    // Ko'p bo'lsa kamaytirish (max ~55 sham)
    const step=Math.max(1,Math.floor(arr.length/55));
    const ohlc=arr.filter((_,i)=>i%step===0);

    // Min/max hisoblash (wick uchun h va l)
    const allP=ohlc.flatMap(([,o,h,l,c])=>[o,h,l,c]);
    const mn=Math.min(...allP),mx=Math.max(...allP);
    const range=mx-mn||1;

    const W=300,H=120,padL=2,padR=2,padT=6,padB=6;
    const n=ohlc.length;
    const slotW=(W-padL-padR)/n;
    const cw=Math.max(1.5,slotW*0.62);
    const py=v=>padT+(1-(v-mn)/range)*(H-padT-padB);

    const candles=ohlc.map(([,o,h,l,c],i)=>{
      const cx=(padL+(i+0.5)*slotW).toFixed(2);
      const isUp=c>=o;
      const col=isUp?'#00d68f':'#ff4757';
      const bodyTop=py(Math.max(o,c)).toFixed(2);
      const bodyH=Math.max(1,Math.abs(py(o)-py(c))).toFixed(2);
      const halfCw=(cw/2).toFixed(2);
      return`<line x1="${cx}" y1="${py(h).toFixed(2)}" x2="${cx}" y2="${py(l).toFixed(2)}" stroke="${col}" stroke-width="0.8" opacity="0.7"/>
<rect x="${(parseFloat(cx)-cw/2).toFixed(2)}" y="${bodyTop}" width="${cw.toFixed(2)}" height="${bodyH}" fill="${col}" rx="0.5"/>`;
    }).join('');

    const pFirst=arr[0][1],pLast=arr[arr.length-1][4];
    const pDiff=((pLast-pFirst)/pFirst*100).toFixed(2);
    const isUp=pLast>=pFirst;
    const fmtP=v=>v>=1000?'$'+fmt(v,0):v>=1?'$'+fmt(v,2):'$'+v.toFixed(4);

    document.getElementById('cdChart').innerHTML=`
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">${candles}</svg>
      <div style="display:flex;justify-content:space-between;font-size:9.5px;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-top:5px;padding:0 2px">
        <span>${days===7?'7 kun':days===30?'1 oy':'3 oy'} oldin: ${fmtP(pFirst)}</span>
        <span style="color:${isUp?'var(--green)':'var(--red)'};font-weight:700">${isUp?'+':''}${pDiff}%</span>
      </div>`;
  }catch(_){
    document.getElementById('cdChart').innerHTML=`<div style="text-align:center;color:var(--text3);font-size:11px;padding:20px 0">Grafik yuklanmadi</div>`;
  }
}

async function loadCryptoAI(){
  const sym=_cdCoin;
  const d=STATE.CRYPTO[sym];
  if(!d) return;
  haptic('select');
  const aiEl=document.getElementById('cdAI');
  aiEl.innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:12px;color:var(--text2);font-size:12px">
    <div class="spinner" style="width:18px;height:18px;border-width:2px;flex-shrink:0"></div>AI tahlil tayyorlanmoqda...</div>`;
  const showResult=txt=>{
    const paras=txt.split('\n').filter(l=>l.trim()).map(l=>`<p style="margin:0 0 8px;line-height:1.6;font-size:12px;color:var(--text2)">${l}</p>`).join('');
    aiEl.innerHTML=`<div>${paras}</div><div style="font-size:10px;color:var(--text3);margin-top:10px;text-align:center">Bu moliyaviy maslahat emas</div>`;
  };
  const showErr=msg=>{
    aiEl.innerHTML=`<div style="color:var(--red);font-size:12px;text-align:center;padding:10px">${msg}</div>
      <button onclick="loadCryptoAI()" style="width:100%;padding:10px;background:var(--surface);border:1px solid var(--glass-border);border-radius:10px;color:var(--text);font-size:12px;cursor:pointer;margin-top:8px">Qayta urinish</button>`;
  };
  // 1. Backend urinish
  try{
    const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),8000);
    const r=await fetch(`/api/ai/analyze?coin=${encodeURIComponent(sym)}&name=${encodeURIComponent(d.name||sym)}&price=${d.usd}&change=${(d.change||0).toFixed(2)}`,{signal:ac.signal});
    clearTimeout(tid);
    const data=await r.json();
    if(data.ok&&data.analysis){showResult(data.analysis);return;}
  }catch(_){}
  // 2. Fallback — Gemini to'g'ridan-to'g'ri
  try{
    const usd=d.usd||0;
    const prompt=`${d.name||sym} (${sym}) kripto valyuta haqida qisqa tahlil yoz (3-4 gap, o'zbek tilida):\nJoriy narx: $${usd>=1?fmt(usd,2):usd.toFixed(4)}\n24s o'zgarish: ${(d.change||0).toFixed(2)}%\n\nNarx tendensiyasi, texnik ko'rsatkichlar va qisqa muddatli prognoz.`;
    const txt=await _callGeminiDirect(prompt);
    if(txt) showResult(txt);
    else showErr('Javob kelmadi');
  }catch(e){
    if(e.message==='no_key')
      aiEl.innerHTML=`<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px">AI Tahlil tabida Gemini API key kiriting</div>`;
    else showErr(e.message||'Xato');
  }
}

// ── STATE.METALS ──
async function loadMetals(){
  async function yfPrice(symbol){
    for(const host of ['query1','query2']){
      try{
        const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),6000);
        const r=await fetch(
          `https://${host}.finance.yahoo.com/v8/finance/chart/${symbol}`,
          {signal:ac.signal}
        );
        clearTimeout(tid);
        if(!r.ok) continue;
        const d=await r.json();
        const meta=d?.chart?.result?.[0]?.meta;
        if(!meta||!(meta.regularMarketPrice>0)) continue;
        return {usd:meta.regularMarketPrice, change:meta.regularMarketChangePercent||0};
      }catch(_){}
    }
    return null;
  }

  let metals = {};

  // 1. Yahoo Finance — oltin GC=F, kumush SI=F, platina PL=F, palladiy PA=F
  const [goldYF,silverYF,platYF,palYF]=await Promise.all([
    yfPrice('GC=F'),yfPrice('SI=F'),yfPrice('PL=F'),yfPrice('PA=F')
  ]);
  if(goldYF?.usd>0)  metals.XAU={usd:goldYF.usd, change:goldYF.change, uzs:goldYF.usd*STATE.USD_UZS, gram:goldYF.usd/31.1035};
  if(silverYF?.usd>0) metals.XAG={usd:silverYF.usd,change:silverYF.change,uzs:silverYF.usd*STATE.USD_UZS,gram:silverYF.usd/31.1035};
  if(platYF?.usd>0)  metals.XPT={usd:platYF.usd,  change:platYF.change,  uzs:platYF.usd*STATE.USD_UZS,  gram:platYF.usd/31.1035};
  if(palYF?.usd>0)   metals.XPD={usd:palYF.usd,   change:palYF.change,   uzs:palYF.usd*STATE.USD_UZS,   gram:palYF.usd/31.1035};

  // 2. CoinGecko — yo'q bo'lgan metallar uchun fallback
  const missing=[];
  if(!metals.XAU) missing.push('pax-gold');
  if(!metals.XAG) missing.push('silver');
  if(!metals.XPT) missing.push('platinum');
  if(!metals.XPD) missing.push('palladium');
  if(missing.length){
    try{
      const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),5000);
      const r=await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${missing.join(',')}&vs_currencies=usd&include_24hr_change=true`,
        {signal:ac.signal}
      );
      clearTimeout(tid);
      const d=await r.json();
      const cgMap={'pax-gold':'XAU','silver':'XAG','platinum':'XPT','palladium':'XPD'};
      for(const [cgId,sym] of Object.entries(cgMap)){
        if(!metals[sym]&&d[cgId]?.usd>0){
          const usd=d[cgId].usd;
          metals[sym]={usd,change:d[cgId].usd_24h_change||0,uzs:usd*STATE.USD_UZS,gram:usd/31.1035};
        }
      }
    }catch(_){}
  }

  STATE.METALS=metals;
  if(Object.keys(metals).length>0){
    renderMetals();
    saveCache();
  }else{
    document.getElementById('m-load').innerHTML=`<div class="ltxt">❌ ${tx('err')}</div>`;
  }
}
// ── Unit toggle ──
function setUnit(unit){
  haptic('select');
  STATE.METAL_UNIT = unit;
  localStorage.setItem('bn_unit', unit);
  document.getElementById('utab-oz').classList.toggle('on', unit==='oz');
  document.getElementById('utab-g').classList.toggle('on', unit==='g');
  renderMetalsGrid();
}

function renderMetalsGrid(){
  document.getElementById('mgrid').innerHTML=Object.entries(STATE.METALS).map(([sym,d])=>{
    const m=MDATA[sym]; if(!m) return'';
    const chg     = d.change||0;
    const gramUsd = d.gram||(d.usd/31.1035);
    const gramUzs = Math.round(gramUsd*STATE.USD_UZS);
    const ozUzs   = Math.round(d.usd*STATE.USD_UZS);

    // Birlikka qarab asosiy narx
    const isGram   = STATE.METAL_UNIT==='g';
    const mainUsd  = isGram ? gramUsd : d.usd;
    const mainUzs  = isGram ? gramUzs : ozUzs;
    const unitLbl  = isGram ? 'g' : 'oz';
    const otherUsd = isGram ? d.usd : gramUsd;
    const otherLbl = isGram ? 'oz' : 'g';

    const chgBadge = `<span class="mch ${cl(chg)}">${ar(chg)} ${Math.abs(chg).toFixed(2)}%</span>`;
    const wkBadge  = d.week_change&&d.week_change!==0
      ?`<span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text3);margin-left:5px">7k: ${d.week_change>0?'+':''}$${Math.abs(d.week_change).toFixed(0)}</span>`:'';

    return`<div class="mtile ${m.cls}">
      <span class="mico">${MLOGO[sym]||sym}</span>
      <div class="msym">${sym} · ${mname(sym)}</div>

      <!-- Asosiy narx: tanlangan birlikda -->
      <div class="mp">$${isGram?gramUsd.toFixed(2):fmt(mainUsd,2)} <span class="ulbl">/${unitLbl}</span></div>

      <!-- UZS narxi -->
      <div class="muzs">${fmtFull(mainUzs)} <span style="opacity:.6">so'm/${unitLbl}</span></div>

      <!-- Trend + 7 kun -->
      <div style="margin:4px 0">${chgBadge}${wkBadge}</div>

      <!-- Boshqa birlik (kichik, xira) -->
      <div class="mgram">1${otherLbl} = $${isGram?fmt(otherUsd,2):gramUsd.toFixed(2)}</div>
    </div>`;
  }).join('');
}


function renderMetals(){
  document.getElementById('m-load').style.display='none';
  document.getElementById('m-body').style.display='block';
  renderMetalsGrid();
}


// ── BANK STAVKALARI ──
const DEP_BANKS=[
  {name:'Anorbank',       dep:25.5, minAmt:500000},
  {name:'TBC Bank',       dep:25,   minAmt:1000000},
  {name:'Kapitalbank',    dep:24,   minAmt:1000000},
  {name:'Davr Bank',      dep:24,   minAmt:500000},
  {name:'Hamkorbank',     dep:23.5, minAmt:1000000},
  {name:'Ipak Yo\'li',   dep:23,   minAmt:1000000},
  {name:'Trustbank',      dep:23,   minAmt:500000},
  {name:'Agrobank',       dep:22,   minAmt:500000},
  {name:'Asaka Bank',     dep:22,   minAmt:1000000},
  {name:'Xalq Banki',     dep:21,   minAmt:500000},
  {name:'Ziraatbank',     dep:20,   minAmt:1000000},
  {name:'Uzpromstroybank',dep:20,   minAmt:500000},
];
const KRED_BANKS=[
  {name:'Xalq Banki',     kred:22, max:500000000},
  {name:'Agrobank',       kred:23, max:200000000},
  {name:'Asaka Bank',     kred:24, max:300000000},
  {name:'Uzpromstroybank',kred:24, max:200000000},
  {name:'TBC Bank',       kred:25, max:150000000},
  {name:'Ipak Yo\'li',   kred:25, max:200000000},
  {name:'Kapitalbank',    kred:26, max:250000000},
  {name:'Hamkorbank',     kred:26, max:200000000},
  {name:'Davr Bank',      kred:27, max:100000000},
  {name:'Trustbank',      kred:27, max:100000000},
  {name:'Anorbank',       kred:28, max:150000000},
];

// ── CURRENCY PICKER ──
const CPICK_ITEMS=[
  {code:'USD',name:'AQSH dollari',    type:'fiat'},
  {code:'EUR',name:'Evro',            type:'fiat'},
  {code:'RUB',name:'Rossiya rubli',   type:'fiat'},
  {code:'GBP',name:'Britaniya funti', type:'fiat'},
  {code:'CNY',name:'Xitoy yuani',     type:'fiat'},
  {code:'KZT',name:'Qozogiston tengesi',type:'fiat'},
  {code:'UZS',name:"O'zbek so'mi",   type:'fiat'},
  {code:'BTC',name:'Bitcoin',         type:'crypto'},
  {code:'ETH',name:'Ethereum',        type:'crypto'},
  {code:'USDT',name:'Tether (USDT)',  type:'crypto'},
  {code:'TON',name:'TON',             type:'crypto'},
  {code:'SOL',name:'Solana',          type:'crypto'},
  {code:'XAU',name:'Oltin (Gold)',    type:'metal'},
];
const CPICK_GROUPS=[
  {label:'💱 Valyutalar', type:'fiat'},
  {label:'₿ Kriptovalyuta', type:'crypto'},
  {label:'🏅 Qimmatli metallar', type:'metal'},
];
let _cpickTarget=null;

function _flagImg(code,w=28,h=19){
  const iso=FL[code];
  if(!iso) return '🏳';
  return `<img src="https://flagcdn.com/h${h*2}/${iso}.png" width="${w}" height="${h}" style="border-radius:3px;object-fit:cover;display:inline-block;vertical-align:middle" loading="lazy" onerror="this.style.display='none'">`;
}
function _cpickIcoHTML(code,size=24){
  if(FL[code]){
    const w=Math.round(size*1.35),h=Math.round(size*.9);
    return `<img src="https://flagcdn.com/h${h*2}/${FL[code]}.png" width="${w}" height="${h}" style="border-radius:4px;object-fit:cover;display:block" loading="lazy" onerror="this.style.display='none'">`;
  }
  if(CLOGO[code]) return `<img src="${CLOGO[code]}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover" onerror="this.outerHTML='<span style=font-size:${Math.round(size*.8)}px>₿</span>'">`;
  if(MLOGO[code]) return `<span class="msvg" style="width:${size}px;height:${size}px;display:inline-flex">${MLOGO[code]}</span>`;
  return `<span style="font-size:${Math.round(size*.8)}px">💰</span>`;
}

function _cpickSetDisplay(which, code){
  document.getElementById(which+'Ico').innerHTML=_cpickIcoHTML(code,22);
  document.getElementById(which+'Val').textContent=code;
}

function openCpick(which){
  haptic('select');
  _cpickTarget=which;
  const cur=document.getElementById(which)?.value||'';
  const list=document.getElementById('cpickList');
  list.innerHTML=CPICK_GROUPS.map(g=>{
    const items=CPICK_ITEMS.filter(i=>i.type===g.type);
    return `<div class="cpick-group-lbl">${g.label}</div>`+
      items.map(item=>`
        <div class="cpick-item${item.code===cur?' on':''}" onclick="selectCpick('${item.code}')">
          <div class="cpick-item-ico">${_cpickIcoHTML(item.code,28)}</div>
          <div class="cpick-item-info">
            <div class="cpick-item-code">${item.code}</div>
            <div class="cpick-item-name">${item.name}</div>
          </div>
          ${item.code===cur?'<div class="cpick-item-chk">✓</div>':''}
        </div>`).join('');
  }).join('');
  document.getElementById('cpickOverlay').classList.add('on');
  document.getElementById('cpickPanel').classList.add('on');
}

function selectCpick(code){
  if(!_cpickTarget) return;
  haptic('impact','light');
  const sel=document.getElementById(_cpickTarget);
  if(sel) sel.value=code;
  _cpickSetDisplay(_cpickTarget, code);
  closeCpick();
  doCalc();
}

function closeCpick(){
  document.getElementById('cpickOverlay').classList.remove('on');
  document.getElementById('cpickPanel').classList.remove('on');
  _cpickTarget=null;
}

// ── CALCULATOR ──
function qa(v){document.getElementById('amt').value=v;doCalc()}

function doSwap(){
  const fc=document.getElementById('fc');
  const tc=document.getElementById('tc');
  const tmp=fc.value; fc.value=tc.value; tc.value=tmp;
  _cpickSetDisplay('fc',fc.value);
  _cpickSetDisplay('tc',tc.value);
  haptic('impact','medium');
  doCalc();
}
function toUZS(a,c){
  if(c==='UZS')return a;
  if(STATE.CBU[c])return a*STATE.CBU[c].rate;
  if(STATE.CRYPTO[c])return a*STATE.CRYPTO[c].uzs;
  if(STATE.METALS[c])return a*STATE.METALS[c].uzs;
  return null;
}
function frUZS(a,c){
  if(c==='UZS')return a;
  if(STATE.CBU[c])return a/STATE.CBU[c].rate;
  if(STATE.CRYPTO[c])return a/STATE.CRYPTO[c].uzs;
  if(STATE.METALS[c])return a/STATE.METALS[c].uzs;
  return null;
}
function doCalc(){
  const a   = parseFloat(document.getElementById('amt').value)||0;
  const f   = document.getElementById('fc').value;
  const t   = document.getElementById('tc').value;
  const fromEl = document.getElementById('resfrom');
  const toEl   = document.getElementById('resto');
  const rateEl = document.getElementById('resrate');

  if(a<=0){
    if(fromEl) fromEl.textContent='—';
    if(toEl)   toEl.textContent='—';
    if(rateEl) rateEl.textContent='';
    return;
  }
  if(f===t){
    if(fromEl) fromEl.textContent=`${fmtFull(a,2)} ${f}`;
    if(toEl)   toEl.textContent=`${fmtFull(a,2)} ${t}`;
    if(rateEl) rateEl.textContent=`1 ${f} = 1 ${t}`;
    return;
  }
  const uzs=toUZS(a,f);
  if(!uzs){
    if(toEl) toEl.textContent='Ma\'lumot kutilmoqda...';
    if(rateEl) rateEl.textContent='Kurs yuklanmoqda';
    return;
  }
  const cv=frUZS(uzs,t);
  if(cv===null){
    if(toEl) toEl.textContent='Ma\'lumot kutilmoqda...';
    return;
  }
  const dp = cv<0.0001?8:cv<1?4:t==='UZS'?0:2;
  const r1 = frUZS(toUZS(1,f),t);
  if(fromEl) fromEl.textContent=`${fmtFull(a,2)} ${f} =`;
  if(toEl)   toEl.textContent=`${fmtFull(cv,dp)} ${t}`;
  if(rateEl) rateEl.textContent=r1!=null?`1 ${f} = ${r1<0.0001?r1.toFixed(8):fmtFull(r1,t==='UZS'?0:4)} ${t}`:'';
}

// ── KREDIT TO'LOV JADVALI ──
function toggleSchedule(){
  const el=document.getElementById('kSchedule');
  const btn=document.getElementById('schedBtn');
  if(el.style.display==='none'){
    el.style.display='block';
    btn.textContent='📅 To\'lov jadvali ▲';
    renderSchedule();
  }else{
    el.style.display='none';
    btn.textContent='📅 To\'lov jadvali ▼';
  }
}
function renderSchedule(){
  const P=parseFloat(document.getElementById('kAmt').value)||0;
  const n=parseFloat(document.getElementById('kMonth').value)||0;
  const rY=parseFloat(document.getElementById('kRate').value)||0;
  if(!P||!n||!rY) return;
  const r=rY/100/12;
  const pow=Math.pow(1+r,n);
  const monthly=Math.round(r===0?P/n:P*(r*pow)/(pow-1));
  let balance=P;
  const maxRows=Math.min(n,24);
  let rows='';
  for(let i=1;i<=maxRows;i++){
    const interest_pay=Math.min(balance*r,monthly);
    const principal_pay=Math.max(0,monthly-interest_pay);
    balance=Math.max(0,balance-principal_pay);
    rows+=`<tr>
      <td style="color:var(--text3)">${i}</td>
      <td>${fmtFull(Math.round(monthly))}</td>
      <td style="color:var(--text2)">${fmtFull(Math.round(principal_pay))}</td>
      <td style="color:var(--red)">${fmtFull(Math.round(interest_pay))}</td>
      <td style="color:var(--text3)">${fmtFull(Math.round(balance))}</td>
    </tr>`;
  }
  const note=n>24?`<div style="text-align:center;color:var(--text3);font-size:10px;padding:6px">... va yana ${n-24} oy</div>`:'';
  document.getElementById('kSchedule').innerHTML=`
    <table class="bank-table" style="font-size:10px">
      <thead><tr>
        <th>Oy</th><th>To'lov</th><th>Asosiy</th><th style="color:var(--red)">Foiz</th><th>Qoldiq</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>${note}`;
}

// ── CALC MODE ──
const ALL_CALC_MODES=['valyuta','kredit','depozit','maosh','bankcomp','maqsad','foyda','stavkadep','stavkakred'];
let calcMode='valyuta';
const CALC_MODE_LABELS={valyuta:'Valyuta',kredit:'Kredit',depozit:'Depozit',maosh:'Maosh',bankcomp:'Bank',maqsad:'Maqsad',foyda:'Foyda',stavkadep:'Depozit ↗',stavkakred:'Kredit ↘'};
function setCalcMode(mode){
  haptic('select');
  calcMode=mode;
  ALL_CALC_MODES.forEach(m=>{
    const el=document.getElementById('calc-'+m);
    if(el) el.style.display=m===mode?'block':'none';
  });
  document.querySelectorAll('.ctab').forEach((b,i)=>{
    b.classList.toggle('on',ALL_CALC_MODES[i]===mode);
  });
  const badge=document.getElementById('calcModeBadge');
  if(badge) badge.textContent=CALC_MODE_LABELS[mode]||mode;
  if(mode==='valyuta') doCalc();
  else if(mode==='kredit') doKredit();
  else if(mode==='depozit') doDepozit();
  else if(mode==='maosh') doMaosh();
  else if(mode==='bankcomp') doBankComp();
  else if(mode==='maqsad') doGoal();
  else if(mode==='foyda'){plFillCurrent();doProfit();}
  else if(mode==='stavkadep') doStavkaDep();
  else if(mode==='stavkakred') doStavkaKred();
}
function kqa(id,v){
  document.getElementById(id).value=v;
  if(id.startsWith('k'))doKredit();
  else if(id.startsWith('d'))doDepozit();
  else if(id.startsWith('g'))doGoal();
  else doMaosh();
}

// ── KREDIT KALKULYATORI ──
function doKredit(){
  const P=parseFloat(document.getElementById('kAmt').value)||0;
  const n=parseFloat(document.getElementById('kMonth').value)||0;
  const rY=parseFloat(document.getElementById('kRate').value)||0;
  const res=document.getElementById('kRes');
  if(P<=0||n<=0||rY<=0||n>600||rY>300){res.classList.remove('on');return}
  const r=rY/100/12;
  const pow=Math.pow(1+r,n);
  if(!isFinite(pow)){res.classList.remove('on');return}
  const monthlyExact=r===0?P/n:P*(r*pow)/(pow-1);
  const monthly=Math.round(monthlyExact);  // yaxlitlangan oylik to'lov
  const total=monthly*n;                   // aynan shu raqam * oy soni
  const interest=total-P;
  const pct=((interest/P)*100).toFixed(1);
  document.getElementById('kMonthly').textContent=fmtFull(monthly)+' so\'m';
  document.getElementById('kTotal').textContent=fmtFull(total)+' so\'m';
  document.getElementById('kInterest').textContent=fmtFull(interest)+' so\'m';
  document.getElementById('kPct').textContent=pct+'%';
  res.classList.add('on');
  if(document.getElementById('kSchedule').style.display!=='none') renderSchedule();
}

// ── DEPOZIT KALKULYATORI ──
function doDepozit(){
  const P=parseFloat(document.getElementById('dAmt').value)||0;
  const n=parseFloat(document.getElementById('dMonth').value)||0;
  const rY=parseFloat(document.getElementById('dRate').value)||0;
  const res=document.getElementById('dRes');
  if(P<=0||n<=0||rY<=0||n>600||rY>300){res.classList.remove('on');return}
  const r=rY/100/12;
  const A=P*Math.pow(1+r,n);
  if(!isFinite(A)){res.classList.remove('on');return}
  const profit=A-P;
  const effRate=((A/P-1)*100).toFixed(2);
  document.getElementById('dProfit').textContent='+'+fmtFull(Math.round(profit))+' so\'m';
  document.getElementById('dTotal').textContent=fmtFull(Math.round(A))+' so\'m';
  document.getElementById('dEff').textContent=effRate+'%';
  res.classList.add('on');
}

// ── MAOSH KALKULYATORI ──
function doMaosh(){
  const a=parseFloat(document.getElementById('mAmt').value)||0;
  const cur=document.getElementById('mCur').value;
  const res=document.getElementById('mRes');
  if(a<=0){res.classList.remove('on');return}
  let uzs=0;
  if(cur==='UZS') uzs=a;
  else if(STATE.CBU[cur]) uzs=a*STATE.CBU[cur].rate;
  else if(STATE.USD_UZS&&cur==='USD') uzs=a*STATE.USD_UZS;
  else{res.classList.remove('on');return}

  // Soliq hisob-kitobi (UZS da)
  const soliq=Math.round(uzs*0.12);   // 12% daromad solig'i
  const inps=Math.round(uzs*0.08);    // 8% INPS (xodim ulushi)
  const netto=Math.round(uzs-soliq-inps); // qo'lga tegadigan

  const usdRate=STATE.CBU.USD?.rate||STATE.USD_UZS||0;
  const currRows=[];
  if(cur!=='USD'&&usdRate) currRows.push(['🇺🇸 Dollar',fmtFull(netto/usdRate,2)+' $']);
  if(cur!=='EUR'&&STATE.CBU.EUR) currRows.push(['🇪🇺 Euro',fmtFull(netto/STATE.CBU.EUR.rate,2)+' €']);

  document.getElementById('mNetto').textContent=fmtFull(netto)+' so\'m';
  document.getElementById('mTax').textContent='−'+fmtFull(soliq)+' so\'m';
  document.getElementById('mInps').textContent='−'+fmtFull(inps)+' so\'m';
  document.getElementById('mBrutto').textContent=fmtFull(Math.round(uzs))+' so\'m';
  document.getElementById('mCurrRows').innerHTML=currRows.map(([k,v])=>`<div class="krow2"><span class="kk">${k}</span><span class="kv">${v}</span></div>`).join('');
  document.getElementById('mYearly').textContent=fmtFull(netto*12)+' so\'m';
  document.getElementById('mDaily').textContent=fmtFull(Math.round(netto/21))+' so\'m';
  // Minimal ish haqi ogohlantirish (2025: 980 000 so'm)
  const warnEl=document.getElementById('mWarn');
  if(warnEl) warnEl.style.display=uzs<980000?'flex':'none';
  res.classList.add('on');
}

// ══════════════════════════════════════════
// ── TREND SIGNAL ──
// ══════════════════════════════════════════
function calcTrendSignal(cur){
  const hist=chartHistory.filter(h=>h[cur]!=null);
  if(hist.length<5) return null;
  const last7=hist.slice(-Math.min(7,hist.length));
  const first=last7[0][cur], last=last7[last7.length-1][cur];
  const change7=((last-first)/first)*100;

  // 3 kunlik momentum
  const last3=hist.slice(-3);
  const change3=last3.length>1?((last3[last3.length-1][cur]-last3[0][cur])/last3[0][cur]*100):0;

  // Kunlik o'zgarishlar volatility
  const dailyChanges=[];
  for(let i=1;i<last7.length;i++)
    dailyChanges.push(Math.abs((last7[i][cur]-last7[i-1][cur])/last7[i-1][cur]*100));
  const avgVolatility=dailyChanges.reduce((a,b)=>a+b,0)/(dailyChanges.length||1);

  return{change7,change3,avgVolatility,days:last7.length};
}

function renderTrendSignal(){
  const wrap=document.getElementById('trendSignalWrap');
  const badgeEl=document.getElementById('trendBadge');
  const barsEl=document.getElementById('trendBars');
  const recEl=document.getElementById('trendRec');
  if(!wrap||chartHistory.length<5){if(wrap)wrap.style.display='none';return;}

  const CURS=['USD','EUR','RUB'];
  const sigs=CURS.map(c=>({c,sig:calcTrendSignal(c)})).filter(x=>x.sig);
  if(!sigs.length){wrap.style.display='none';return;}
  wrap.style.display='block';

  // Trend barlar
  const maxAbs=Math.max(...sigs.map(x=>Math.abs(x.sig.change7)),0.5);
  barsEl.innerHTML=sigs.map(({c,sig})=>{
    const pct=sig.change7;
    const isUp=pct>=0;
    const barW=Math.min(Math.abs(pct)/maxAbs*100,100);
    const color=isUp?'var(--red)':'var(--green)'; // up=USD costs more=bad for buyers
    return`<div class="trend-row">
      <span class="trend-cur">${c}</span>
      <div class="trend-bar-bg">
        <div class="trend-bar-fill" style="width:${barW}%;background:${color}"></div>
      </div>
      <span style="font-size:10px;font-weight:600;color:${color};font-family:'JetBrains Mono',monospace;width:52px;text-align:right">${isUp?'+':''}${pct.toFixed(2)}%</span>
    </div>`;
  }).join('');

  // Asosiy signal (USD bo'yicha)
  const usdSig=sigs.find(x=>x.c==='USD')?.sig;
  if(!usdSig){badgeEl.innerHTML='';recEl.innerHTML='';return;}

  let badge,recClass,recText;
  const isHighVol=usdSig.avgVolatility>0.5;

  if(isHighVol){
    badge='<span class="trend-signal-badge volatile">⚡ Yuqori o\'zgaruvchanlik</span>';
    recClass='wait';
    recText='<b>⏳ Kutish tavsiya:</b> Kurs keskin o\'zgarmoqda. Turg\'un holatni kuting.';
  } else if(usdSig.change7>2&&usdSig.change3>0.3){
    badge='<span class="trend-signal-badge up">📈 O\'sish tendensiyasi</span>';
    recClass='sell';
    recText='<b>💡 Sotish qulay:</b> USD narxi 7 kunda oshdi. Dollarda tejamingiz bo\'lsa, hozir sotish foydali.';
  } else if(usdSig.change7<-1.5&&usdSig.change3<0){
    badge='<span class="trend-signal-badge down">📉 Tushish tendensiyasi</span>';
    recClass='buy';
    recText='<b>✅ Sotib olish qulay:</b> USD narxi pastlashmoqda. Arzonroq kursda dollar sotib olish imkoni bor.';
  } else if(usdSig.change7>0.5&&usdSig.change3>0){
    badge='<span class="trend-signal-badge up">↗ Sekin o\'sish</span>';
    recClass='wait';
    recText='<b>📊 Kuzatish:</b> Kurs asta ko\'tarilmoqda. Keskin harakat qilish shart emas.';
  } else {
    badge='<span class="trend-signal-badge stable">📊 Barqaror kurs</span>';
    recClass='wait';
    recText='<b>📊 Barqaror:</b> Kurs '+usdSig.days+' kun davomida deyarli o\'zgarmadi.';
  }

  badgeEl.innerHTML=badge;
  recEl.innerHTML=`<div class="trend-rec ${recClass}" style="font-size:11px;color:var(--text)">${recText}</div>`;
}

// ══════════════════════════════════════════
// ── SHARE CARD ──
// ══════════════════════════════════════════
function shareRates(){
  haptic('impact','medium');
  _buildShareCard();
  document.getElementById('shareOverlay').classList.add('open');
  showBackButton(()=>closeShareModal());
}

function closeShareModal(e){
  if(e&&e.target!==document.getElementById('shareOverlay')) return;
  document.getElementById('shareOverlay').classList.remove('open');
  hideBackButton();
}

function _buildShareCard(){
  const now=new Date();
  const dateStr=now.toLocaleDateString('uz-UZ',{day:'2-digit',month:'long',year:'numeric'});
  const timeStr=now.toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('scDate').innerHTML=`${dateStr}<br>${timeStr}`;

  // STATE.CBU qatorlar
  const cbuCurs=[['USD','🇺🇸'],['EUR','🇪🇺'],['RUB','🇷🇺'],['GBP','🇬🇧'],['CNY','🇨🇳']];
  document.getElementById('scCbuRows').innerHTML=cbuCurs
    .filter(([c])=>STATE.CBU[c])
    .map(([c,flag])=>{
      const d=STATE.CBU[c];
      const chg=d.diff_pct!=null?`<span class="sc-change" style="color:${d.diff_pct>=0?'#2ecc71':'#e74c3c'}">${d.diff_pct>=0?'▲':'▼'}${Math.abs(d.diff_pct).toFixed(2)}%</span>`:'';
      return`<div class="sc-row">
        <span class="sc-lbl">${flag} ${c}</span>
        <span class="sc-val">${fmtFull(d.rate,d.rate<1000?2:0)} <span style="opacity:.5;font-size:10px">so'm</span>${chg}</span>
      </div>`;
    }).join('');

  // P2P
  const p2pEl=document.getElementById('scP2PSection');
  const p2pRows=document.getElementById('scP2PRows');
  if(P2P.buy?.length||P2P.sell?.length){
    p2pEl.style.display='block';
    const buy=P2P.buy?.[0]?.price,sell=P2P.sell?.[0]?.price;
    p2pRows.innerHTML=`
      <div class="sc-row">
        <span class="sc-lbl">💚 Olish (eng arzon)</span>
        <span class="sc-val" style="color:#2ecc71">${buy?fmtFull(buy,0):'—'}</span>
      </div>
      <div class="sc-row">
        <span class="sc-lbl">🔴 Sotish (eng yuqori)</span>
        <span class="sc-val" style="color:#e74c3c">${sell?fmtFull(sell,0):'—'}</span>
      </div>`;
  }else p2pEl.style.display='none';

  // Oltin
  const goldEl=document.getElementById('scGoldSection');
  const goldRows=document.getElementById('scGoldRows');
  if(STATE.METALS.XAU){
    goldEl.style.display='block';
    const g=STATE.METALS.XAU;
    goldRows.innerHTML=`
      <div class="sc-row">
        <span class="sc-lbl">🥇 Oltin (1 oz)</span>
        <span class="sc-val">$${fmt(g.usd,0)}</span>
      </div>
      <div class="sc-row">
        <span class="sc-lbl">🥇 1 gramm</span>
        <span class="sc-val">${fmtFull(Math.round(g.gram*STATE.USD_UZS))} <span style="opacity:.5;font-size:10px">so'm</span></span>
      </div>`;
  }else goldEl.style.display='none';

  // Eng yaxshi bank
  const bankEl=document.getElementById('scBestBank');
  const bankVal=document.getElementById('scBestBankVal');
  const usdRows=STATE.BANK_RATES.USD||[];
  if(usdRows.length){
    bankEl.style.display='block';
    const best=usdRows.reduce((a,b)=>b.buy>a.buy?b:a,usdRows[0]);
    bankVal.textContent=`${best.name} — Sotib olish: ${fmtFull(best.buy,0)} so'm`;
  }else bankEl.style.display='none';
}

function _buildShareText(){
  const now=new Date();
  const d=now.toLocaleDateString('uz-UZ',{day:'2-digit',month:'long',year:'numeric'});
  const t=now.toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
  let txt=`🏦 BANK NEWS · Valyuta Kurslari\n📅 ${d} · ${t}\n`;
  txt+=`${'─'.repeat(30)}\n`;
  txt+=`🏛 Markaziy Bank (STATE.CBU)\n`;
  if(STATE.CBU.USD) txt+=`🇺🇸 USD  ${fmtFull(STATE.CBU.USD.rate)} so'm\n`;
  if(STATE.CBU.EUR) txt+=`🇪🇺 EUR  ${fmtFull(STATE.CBU.EUR.rate)} so'm\n`;
  if(STATE.CBU.RUB) txt+=`🇷🇺 RUB  ${STATE.CBU.RUB.rate.toFixed(2)} so'm\n`;
  if(P2P.buy?.[0]||P2P.sell?.[0]){
    txt+=`${'─'.repeat(30)}\n💱 P2P Bozor (USDT/UZS)\n`;
    if(P2P.buy?.[0]) txt+=`💚 Olish: ${fmtFull(P2P.buy[0].price,0)} so'm\n`;
    if(P2P.sell?.[0]) txt+=`🔴 Sotish: ${fmtFull(P2P.sell[0].price,0)} so'm\n`;
  }
  if(STATE.METALS.XAU){
    txt+=`${'─'.repeat(30)}\n🥇 Oltin: $${fmt(STATE.METALS.XAU.usd,0)}/oz\n`;
  }
  const usdRows=STATE.BANK_RATES.USD||[];
  if(usdRows.length){
    const best=usdRows.reduce((a,b)=>b.buy>a.buy?b:a,usdRows[0]);
    txt+=`${'─'.repeat(30)}\n⭐ Eng yaxshi: ${best.name}\n   BUY: ${fmtFull(best.buy)} so'm\n`;
  }
  txt+=`${'─'.repeat(30)}\n📱 Bank News · Real vaqt ma'lumotlari`;
  return txt;
}

async function doShareCopy(){
  haptic('notify','success');
  const text=_buildShareText();
  try{
    await navigator.clipboard.writeText(text);
    if(tg) tg.showPopup({message:'✅ Nusxalandi! Telegram yoki boshqa joyga joylashtiring.',buttons:[{type:'ok'}]});
    else alert('✅ Nusxalandi!');
  }catch(_){}
}

function doShareTelegram(){
  haptic('impact','medium');
  const text=_buildShareText();
  const url='https://t.me/share/url?url=https%3A%2F%2Ft.me&text='+encodeURIComponent(text);
  if(tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url,'_blank');
}

// ── COPY RESULT ──
async function copyResult(){
  haptic('notify','success');
  const from=document.getElementById('resfrom').textContent;
  const to=document.getElementById('resto').textContent;
  const rate=document.getElementById('resrate').textContent;
  const text=`${from} → ${to}\n${rate}`;
  try{
    if(navigator.clipboard) await navigator.clipboard.writeText(text);
    if(tg) tg.showPopup({message:'✅ Nusxalandi!',buttons:[{type:'ok'}]});
    else alert('✅ Nusxalandi!');
  }catch(_){}
}

// ── BANK CALCULATOR BOTTOM SHEET ──
let _bsBank={name:'',buy:0,sell:0};
let _bsDir='buy';   // 'buy' = foydalanuvchi sotadi | 'sell' = foydalanuvchi oladi
let _bsSwapped=false; // false = valyuta→UZS, true = UZS→valyuta

function openMetalsPanel(){
  haptic('impact','light');
  document.getElementById('metalsPanel').classList.add('open');
  if(Object.keys(STATE.METALS).length) renderMetals();
  else loadMetals();
  showBackButton(()=>closeMetalsPanel());
}
function closeMetalsPanel(){
  document.getElementById('metalsPanel').classList.remove('open');
  hideBackButton();
}
function openCryptoPanel(){
  haptic('impact','light');
  document.getElementById('cryptoPanel').classList.add('open');
  if(Object.keys(STATE.CRYPTO).length) renderCrypto();
  else loadCrypto();
  if(Object.keys(P2P).length) renderP2P();
  else loadP2P();
  showBackButton(()=>closeCryptoPanel());
}
function closeCryptoPanel(){
  document.getElementById('cryptoPanel').classList.remove('open');
  hideBackButton();
}
function openBankListPanel(){
  haptic('impact','light');
  document.getElementById('bankListPanel').classList.add('open');
  renderBankTable();
  showBackButton(()=>closeBankListPanel());
}
function closeBankListPanel(){
  document.getElementById('bankListPanel').classList.remove('open');
  hideBackButton();
}
function openBankCalc(name,buy,sell){
  haptic('impact','medium');
  _bsBank={name,buy,sell};
  _bsDir='buy';
  _bsSwapped=false;
  document.getElementById('bsName').textContent=name;
  document.getElementById('bsCur').textContent=STATE.BANK_CUR+' konverteri';
  const dec=STATE.BANK_CUR==='RUB'?2:0;
  document.getElementById('bsBuyNum').textContent=fmtFull(buy,dec);
  document.getElementById('bsSellNum').textContent=fmtFull(sell,dec);
  document.getElementById('bsSwapCur').textContent=STATE.BANK_CUR;
  document.getElementById('bsAmt').value='100';
  _bsApplyDir();
  doBankCalc();
  document.getElementById('bsOverlay').classList.add('open');
  document.getElementById('bsPanel').classList.add('open');
  document.getElementById('bsAmt').focus();
  showBackButton(()=>closeBankCalc());
}

function closeBankCalc(){
  haptic('impact','soft');
  document.getElementById('bsOverlay').classList.remove('open');
  document.getElementById('bsPanel').classList.remove('open');
  hideBackButton();
}

function setBsDir(dir){
  haptic('select');
  _bsDir=dir;
  _bsSwapped=false;
  _bsApplyDir();
  doBankCalc();
}

function swapBsDir(){
  haptic('impact','light');
  _bsSwapped=!_bsSwapped;
  _bsApplyDir();
  doBankCalc();
}

function _bsApplyDir(){
  const dec=STATE.BANK_CUR==='RUB'?2:0;
  const cur=STATE.BANK_CUR;
  const isBuy=_bsDir==='buy';

  // Dir tugmalar
  document.getElementById('bsDirBuy').classList.toggle('on',isBuy);
  document.getElementById('bsDirSell').classList.toggle('on',!isBuy);

  // Kurs badge
  const rate=isBuy?_bsBank.buy:_bsBank.sell;
  const spread=_bsBank.sell-_bsBank.buy;
  document.getElementById('bsRateLbl').textContent=isBuy?'Sotib olish kursi (siz sotasiz)':'Sotish kursi (siz olasiz)';
  document.getElementById('bsRateVal').textContent=fmtFull(rate,dec);
  document.getElementById('bsRateVal').style.color=isBuy?'var(--green)':'var(--red)';
  document.getElementById('bsSpreadVal').textContent=fmtFull(spread,dec);

  // Input label
  if(_bsSwapped){
    document.getElementById('bsAmtCur').textContent='UZS';
    document.getElementById('bsResLbl').textContent=`Siz olasiz (${cur})`;
    document.getElementById('bsResCur').textContent=cur;
  }else{
    document.getElementById('bsAmtCur').textContent=cur;
    document.getElementById('bsResLbl').textContent='Siz olasiz (so\'m)';
    document.getElementById('bsResCur').textContent='so\'m';
  }
}

function doBankCalc(){
  const amt=parseFloat(document.getElementById('bsAmt').value)||0;
  if(!amt){document.getElementById('bsResVal').textContent='—';return;}
  const isBuy=_bsDir==='buy';
  const rate=isBuy?_bsBank.buy:_bsBank.sell;
  const dec=STATE.BANK_CUR==='RUB'?2:0;
  let result, color;
  if(_bsSwapped){
    // UZS → valyuta
    result=amt/rate;
    color=isBuy?'var(--green)':'var(--red)';
    document.getElementById('bsResVal').textContent=fmtFull(result,dec>0?4:2);
  }else{
    // valyuta → UZS
    result=amt*rate;
    color=isBuy?'var(--green)':'var(--red)';
    document.getElementById('bsResVal').textContent=fmtFull(Math.round(result));
  }
  document.getElementById('bsResVal').style.color=color;
}

async function copyBsResult(){
  const bankName=_bsBank.name;
  const isBuy=_bsDir==='buy';
  const rate=isBuy?_bsBank.buy:_bsBank.sell;
  const dec=STATE.BANK_CUR==='RUB'?2:0;
  const amt=parseFloat(document.getElementById('bsAmt').value)||0;
  const cur=STATE.BANK_CUR;
  const dirLbl=isBuy?'Sotib olish':'Sotish';
  let resText='';
  if(_bsSwapped){
    const res=amt/rate;
    resText=`${fmtFull(amt)} UZS → ${fmtFull(res,2)} ${cur}`;
  }else{
    const res=amt*rate;
    resText=`${fmtFull(amt,dec)} ${cur} → ${fmtFull(Math.round(res))} so'm`;
  }
  const text=`${bankName} | ${dirLbl} kursi: ${fmtFull(rate,dec)} so'm\n${resText}`;
  try{
    await navigator.clipboard.writeText(text);
    if(tg?.showPopup) tg.showPopup({message:'✅ Nusxalandi!',buttons:[{type:'ok'}]});
    else alert('✅ Nusxalandi!');
  }catch(_){}
}

function sendToCalc(){
  // Valyuta kalkulyatoriga shu kursni uzatadi
  const amt=parseFloat(document.getElementById('bsAmt').value)||1;
  const isBuy=_bsDir==='buy';
  const rate=isBuy?_bsBank.buy:_bsBank.sell;
  closeBankCalc();
  goTab(2);
  setCalcMode('valyuta');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const amtEl=document.getElementById('amt');
    const fcEl=document.getElementById('fc');
    const tcEl=document.getElementById('tc');
    if(amtEl) amtEl.value=amt;
    if(fcEl){fcEl.value=STATE.BANK_CUR;_cpickSetDisplay('fc',STATE.BANK_CUR);}
    if(tcEl){tcEl.value='UZS';_cpickSetDisplay('tc','UZS');}
    doCalc();
  }));
}

// ══════════════════════════════════════════
// ── PORTFOLIO DONUT CHART ──
// ══════════════════════════════════════════
const PORT_COLORS={
  USD:'#3498db',EUR:'#9b59b6',RUB:'#e74c3c',GBP:'#2ecc71',
  CNY:'#e67e22',KZT:'#1abc9c',BTC:'#f39c12',ETH:'#627eea',
  USDT:'#26a17b',TON:'#0088cc',SOL:'#9945ff',XAU:'#d4a843'
};
let _portChartInst=null;

function renderPortChart(items){
  const wrap=document.getElementById('portChartWrap');
  if(!wrap) return;

  const data=items.filter(it=>it.val>0);
  if(data.length<2){wrap.style.display='none';return;}

  wrap.style.display='block';
  const labels=data.map(it=>it.p.sym);
  const values=data.map(it=>it.val);
  const total=values.reduce((a,b)=>a+b,0);
  const colors=labels.map(s=>PORT_COLORS[s]||'#aaa');

  // Eng katta ulush
  const maxIdx=values.indexOf(Math.max(...values));
  const maxPct=((values[maxIdx]/total)*100).toFixed(1);
  document.getElementById('portChartPct').textContent=maxPct+'%';
  document.getElementById('portChartPct').style.color=colors[maxIdx];
  document.getElementById('portChartLbl').textContent=labels[maxIdx];

  // Legend
  document.getElementById('portLegend').innerHTML=data.map((it,i)=>{
    const pct=((it.val/total)*100).toFixed(1);
    return`<div class="port-legend-row">
      <div class="port-legend-dot" style="background:${colors[i]}"></div>
      <span class="port-legend-sym">${it.p.sym}</span>
      <span style="font-size:10px;color:var(--text2);flex:1">${fmtFull(Math.round(it.val))}</span>
      <span class="port-legend-pct">${pct}%</span>
    </div>`;
  }).join('');

  // Chart.js donut
  if(_portChartInst){_portChartInst.destroy();_portChartInst=null;}
  const ctx=document.getElementById('portChart')?.getContext('2d');
  if(!ctx) return;
  _portChartInst=new Chart(ctx,{
    type:'doughnut',
    data:{labels,datasets:[{data:values,backgroundColor:colors,borderColor:'transparent',borderWidth:0,hoverOffset:6}]},
    options:{
      cutout:'70%',
      plugins:{legend:{display:false},tooltip:{
        callbacks:{label:c=>`${c.label}: ${((c.raw/total)*100).toFixed(1)}%`},
        backgroundColor:'var(--card2)',titleColor:'var(--text)',bodyColor:'var(--text2)',
        borderColor:'var(--border)',borderWidth:1
      }},
      animation:{duration:500},
    }
  });
}

// ══════════════════════════════════════════
// ── GEOLOCATION ──
// ══════════════════════════════════════════
let _geoPos=null;

function openGeoSheet(){
  haptic('impact','medium');
  document.getElementById('geoOverlay').classList.add('open');
  document.getElementById('geoSheet').classList.add('open');
  document.getElementById('geoStatus').textContent='Joylashuv aniqlanmoqda...';
  document.getElementById('geoList').innerHTML=`<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">
    <div style="font-size:28px;margin-bottom:8px">📡</div>Joylashuvingiz aniqlanmoqda...
  </div>`;
  showBackButton(()=>closeGeoSheet());

  if(_geoPos){
    _renderGeoList(_geoPos.lat,_geoPos.lng);
    return;
  }

  // Telegram LocationManager bilan sinab ko'rish (yangi API)
  if(tg?.LocationManager?.isInited!==false){
    try{
      tg?.LocationManager?.getLocation(loc=>{
        if(loc?.latitude){
          _geoPos={lat:loc.latitude,lng:loc.longitude};
          _renderGeoList(_geoPos.lat,_geoPos.lng);
        }else _tryBrowserGeo();
      });
      return;
    }catch(_){}
  }
  _tryBrowserGeo();
}

function _tryBrowserGeo(){
  if(!navigator.geolocation){
    _geoNoLocation();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos=>{
      _geoPos={lat:pos.coords.latitude,lng:pos.coords.longitude};
      _renderGeoList(_geoPos.lat,_geoPos.lng);
    },
    _=>_geoNoLocation(),
    {timeout:8000,maximumAge:60000}
  );
}

function _geoNoLocation(){
  document.getElementById('geoStatus').textContent='Joylashuv aniqlanmadi';
  document.getElementById('geoList').innerHTML=`<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">
    <div style="font-size:28px;margin-bottom:8px">📵</div>
    Joylashuvga ruxsat berilmadi.<br>Quyida bankni qo'lda qidiring.
  </div>
  ${_geoTopBanksHtml(null,null)}`;
}

function _renderGeoList(lat,lng){
  document.getElementById('geoStatus').textContent=`📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  document.getElementById('geoList').innerHTML=_geoTopBanksHtml(lat,lng);
}

function _geoTopBanksHtml(lat,lng){
  const rows=STATE.BANK_RATES[STATE.BANK_CUR]||[];
  if(!rows.length) return`<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">Bank ma'lumotlari yo'q</div>`;

  const sorted=[...rows].sort((a,b)=>b.buy-a.buy);
  const topBuy=sorted[0];
  const topSell=[...rows].sort((a,b)=>a.sell-b.sell)[0];
  const dec=STATE.BANK_CUR==='RUB'?2:0;

  const mapsUrl=(name,la,lo)=>{
    const q=encodeURIComponent(name+' bank Toshkent');
    return la?`https://www.google.com/maps/search/${q}/@${la},${lo},14z`
             :`https://www.google.com/maps/search/${q}`;
  };

  const makeRow=(bank,tag,tagColor)=>`
    <div class="geo-map-btn" onclick="window.open('${mapsUrl(bank.name,lat,lng)}','_blank')">
      <div class="geo-map-ico">🏦</div>
      <div style="flex:1">
        <div class="geo-map-name">${bank.name}</div>
        <div class="geo-map-sub">
          <span style="color:${tagColor};font-weight:700">${tag}</span> &nbsp;·&nbsp;
          Sotib olish: <b>${fmtFull(bank.buy,dec)}</b> &nbsp;·&nbsp;
          Sotish: <b>${fmtFull(bank.sell,dec)}</b>
        </div>
      </div>
      <div class="geo-map-arr">↗</div>
    </div>`;

  let html=`<div style="padding:10px 18px 4px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px">${STATE.BANK_CUR} — Eng yaxshi kurslar</div>`;
  html+=makeRow(topBuy,'💚 Eng yuqori sotib olish','var(--green)');
  if(topSell.name!==topBuy.name)
    html+=makeRow(topSell,'💛 Eng arzon sotish','var(--gold)');

  // Qolgan top 5 bank
  const others=sorted.slice(1,6).filter(b=>b.name!==topSell.name);
  if(others.length){
    html+=`<div style="padding:10px 18px 4px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Boshqa yaxshi banklar</div>`;
    others.forEach(b=>{ html+=makeRow(b,'','var(--text2)'); });
  }
  return html;
}

function closeGeoSheet(){
  haptic('impact','soft');
  document.getElementById('geoOverlay').classList.remove('open');
  document.getElementById('geoSheet').classList.remove('open');
  hideBackButton();
}

// ── BANK COPY ──
async function copyBankRate(name,buy,sell){
  const dec=STATE.BANK_CUR==='RUB'?2:0;
  const buyLbl=STATE.LANG==='ru'?'Покупка':STATE.LANG==='en'?'Buy':'Sotib olish';
  const sellLbl=STATE.LANG==='ru'?'Продажа':STATE.LANG==='en'?'Sell':'Sotish';
  const text=`${name} (${STATE.BANK_CUR})\n${buyLbl}: ${fmtFull(buy,dec)} so'm\n${sellLbl}: ${fmtFull(sell,dec)} so'm`;
  try{
    if(navigator.clipboard) await navigator.clipboard.writeText(text);
    if(tg) tg.showPopup({message:`📋 ${name} nusxalandi!`,buttons:[{type:'ok'}]});
    else alert(`📋 Nusxalandi!`);
  }catch(_){}
}

// ── CHART ──
let chartInst=null,chartCur='USD',chartHistory=[];

function updateChartSummary(){
  const el=document.getElementById('chartSummary');
  const el2=document.getElementById('chartChange');
  if(!el||!el2) return;
  if(chartHistory.length<2){el.textContent='';el2.textContent='';return;}
  const first=chartHistory[0][chartCur],last=chartHistory[chartHistory.length-1][chartCur];
  if(!first||!last){el.textContent='';el2.textContent='';return;}
  const diff=last-first,pct=((diff/first)*100).toFixed(2);
  const up=diff>=0;
  const col=up?'var(--green)':'var(--red)';
  el2.innerHTML=`<span style="color:${col}">${up?'▲':'▼'} ${Math.abs(pct)}%</span>`;
  el.innerHTML=`<span style="color:${col}">${up?'▲':'▼'} ${Math.abs(diff).toFixed(0)} so'm</span> &nbsp;·&nbsp; ${fmtFull(Math.round(first))} → ${fmtFull(Math.round(last))} &nbsp;<span style="opacity:.5">(${chartHistory.length} kun)</span>`;
}

function renderChartFromHistory(){
  const wrap=document.getElementById('chartWrap');
  if(!wrap) return;
  if(chartHistory.length<2){
    if(chartInst){chartInst.destroy();chartInst=null;}
    wrap.innerHTML=`<div class="chart-empty">${tx('chart_empty')}</div>`;
    renderTrendSignal();
    return;
  }
  wrap.innerHTML='<canvas id="rateChart"></canvas>';
  renderChart();
  renderTrendSignal();
}

function renderChart(){
  if(!chartHistory.length) return;
  const labels=chartHistory.map(h=>h.date.slice(5).replace('-','.'));
  const data=chartHistory.map(h=>h[chartCur]||null);
  const ctx=document.getElementById('rateChart')?.getContext('2d');
  if(!ctx) return;
  if(chartInst){chartInst.destroy();chartInst=null;}
  const dark=STATE.THEME==='dark';
  const gridColor=dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)';
  const tickColor=dark?'#6e8aac':'#8090a8';
  chartInst=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[{data,borderColor:'#d4a843',
      backgroundColor:'rgba(212,168,67,0.08)',borderWidth:2,
      pointRadius:data.length<=15?3:1,pointBackgroundColor:'#d4a843',
      fill:true,tension:0.35,spanGaps:true}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{
        callbacks:{label:c=>fmtFull(c.raw,2)+' so\'m'},
        backgroundColor:dark?'#1a2133':'#fff',
        titleColor:dark?'#e2eaf8':'#0d1a30',
        bodyColor:dark?'#aab8c8':'#4a6080',
        borderColor:dark?'#1f2d42':'#dde4f0',borderWidth:1
      }},
      scales:{
        x:{ticks:{color:tickColor,font:{size:9},maxTicksLimit:8},grid:{color:gridColor}},
        y:{ticks:{color:tickColor,font:{size:9},callback:v=>fmtFull(v)},grid:{color:gridColor}},
      }
    }
  });
  updateChartSummary();
  saveCache();
}

function setChartCur(cur,btn){
  chartCur=cur;
  document.querySelectorAll('.ccbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  updateChartSummary();
  const wrap=document.getElementById('chartWrap');
  if(chartHistory.length<2){
    wrap.innerHTML=`<div class="chart-empty">${tx('chart_empty')}</div>`;
    return;
  }
  wrap.innerHTML='<canvas id="rateChart"></canvas>';
  renderChart();
}

// ── LOAD ALL ──
async function loadAll(){
  haptic('impact','medium');
  const btn=document.getElementById('refBtn');
  btn.classList.add('spin');
  document.getElementById('v-load').style.display='flex';document.getElementById('v-body').style.display='none';
  document.getElementById('c-load').style.display='flex';document.getElementById('c-body').style.display='none';
  document.getElementById('m-load').style.display='flex';document.getElementById('m-body').style.display='none';
  // Grafik loading holati — eski grafik o'chib, spinner ko'rinadi
  const cw=document.getElementById('chartWrap');
  if(cw) cw.innerHTML='<div class="chart-empty"><div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto"></div></div>';
  // loadChart alohida emas — loadBankRates ichida BANKS_URL bitta marta fetch qilinadi
  await Promise.all([loadCBU(),loadCrypto(),loadMetals()]);
  loadP2P(); // P2P: alohida, bloklash kerak emas
  btn.classList.remove('spin');
  doCalc();
}

// ══════════════════════════════════════════
// ── PORTFEL KUZATUVI ──
// ══════════════════════════════════════════
let PORTFOLIO=JSON.parse(localStorage.getItem('bn_portfolio')||'[]');

function savePort(){localStorage.setItem('bn_portfolio',JSON.stringify(PORTFOLIO));}

function portSymUZS(sym,amt){
  if(sym==='UZS') return amt;
  if(STATE.CBU[sym]) return amt*STATE.CBU[sym].rate;
  if(STATE.CRYPTO[sym]) return amt*STATE.CRYPTO[sym].uzs;
  if(STATE.METALS[sym]) return amt*STATE.METALS[sym].uzs;
  return null;
}
const PORT_FLAGS={USD:'🇺🇸',EUR:'🇪🇺',RUB:'🇷🇺',GBP:'🇬🇧',CNY:'🇨🇳',KZT:'🇰🇿',BTC:'₿',ETH:'⟠',USDT:'💵',TON:'💎',SOL:'◎',XAU:'🥇'};

function renderPortfolio(){
  const totalEl=document.getElementById('portTotalWrap');
  const listEl=document.getElementById('portList');
  if(!totalEl||!listEl) return;

  if(!PORTFOLIO.length){
    totalEl.innerHTML='';
    const cw=document.getElementById('portChartWrap');
    if(cw) cw.style.display='none';
    if(_portChartInst){_portChartInst.destroy();_portChartInst=null;}
    listEl.innerHTML=`<div class="port-empty"><div class="port-empty-ico">💼</div>Hozircha aktiv yo'q.<br>Yuqoridagi tugmani bosing va birinchi aktivingizni qo'shing.</div>`;
    return;
  }

  let totalUZS=0, allKnown=true;
  const items=PORTFOLIO.map(p=>{
    const val=portSymUZS(p.sym, p.amt);
    if(val===null||val===undefined) allKnown=false;
    else totalUZS+=val;
    let pnlHtml='';
    if(p.buyPrice&&p.buyPrice>0&&val!==null){
      const boughtUZS=p.amt*p.buyPrice;
      const diff=val-boughtUZS;
      const pct=((diff/boughtUZS)*100).toFixed(2);
      const cls=diff>=0?'up':'dn';
      pnlHtml=`<div class="port-pnl ${cls}">${diff>=0?'▲':'▼'} ${Math.abs(pct)}% (${diff>=0?'+':''}${fmtFull(Math.round(diff))} so'm)</div>`;
    }
    return {p,val,pnlHtml};
  });

  const usdVal=STATE.CBU.USD?.rate||STATE.USD_UZS;
  totalEl.innerHTML=`<div class="port-total">
    <div class="port-total-lbl">Jami portfel qiymati</div>
    <div class="port-total-val">${fmtFull(Math.round(totalUZS))} <span style="font-size:14px;opacity:.7">so'm</span></div>
    ${usdVal?`<div class="port-total-usd">≈ $${fmtFull(Math.round(totalUZS/usdVal))} USD</div>`:''}
  </div>`;

  listEl.innerHTML=items.map(({p,val,pnlHtml})=>`
    <div class="port-item">
      <div class="port-il">
        <div style="font-size:22px;width:36px;text-align:center">${PORT_FLAGS[p.sym]||'💱'}</div>
        <div>
          <div class="port-sym">${p.sym}</div>
          <div class="port-amt">${fmtFull(p.amt,p.amt<1?6:2)} ${p.sym}</div>
        </div>
      </div>
      <div class="port-ir">
        <div class="port-val">${val!==null?fmtFull(Math.round(val))+' so\'m':'—'}</div>
        ${pnlHtml}
      </div>
      <button class="port-del" onclick="deletePortAsset(${p.id})">×</button>
    </div>`).join('');

  renderPortChart(items);
}

function togglePortForm(){
  haptic('impact','medium');
  const f=document.getElementById('portForm');
  const opening=f.style.display==='none'||f.style.display==='';
  f.style.display=opening?'block':'none';
  if(opening){
    document.getElementById('pAmt').value='';
    document.getElementById('pBuy').value='';
    document.getElementById('pPreview').textContent='';
    // BackButton: formni yopadi
    showBackButton(()=>togglePortForm());
    // MainButton: Saqlash
    if(tg?.MainButton){
      if(STATE._mbHandler){tg.MainButton.offClick(STATE._mbHandler);STATE._mbHandler=null;}
      tg.MainButton.setParams({text:'✅ Saqlash',color:'#2ecc71',text_color:'#000000'});
      tg.MainButton.show();
      STATE._mbHandler=()=>{haptic('notify','success');savePortAsset();};
      tg.MainButton.onClick(STATE._mbHandler);
    }
  }else{
    hideBackButton();
    updateMainButton(4);
  }
}

function previewPortAsset(){
  const sym=document.getElementById('pSym').value;
  const amt=parseFloat(document.getElementById('pAmt').value)||0;
  const prev=document.getElementById('pPreview');
  if(!amt||!sym){prev.textContent='';return;}
  const val=portSymUZS(sym,amt);
  prev.textContent=val!==null?`≈ ${fmtFull(Math.round(val))} so'm`:'Kurs yuklanmagan';
}

function savePortAsset(){
  const sym=document.getElementById('pSym').value;
  const amt=parseFloat(document.getElementById('pAmt').value)||0;
  const buyPrice=parseFloat(document.getElementById('pBuy').value)||0;
  if(!amt||amt<=0){
    haptic('notify','error');
    if(tg)tg.showPopup({message:'Miqdorni kiriting!',buttons:[{type:'ok'}]});
    return;
  }
  haptic('notify','success');
  PORTFOLIO.push({id:Date.now(),sym,amt,buyPrice:buyPrice||0});
  savePort();
  togglePortForm();
  renderPortfolio();
}

function deletePortAsset(id){
  haptic('notify','warning');
  PORTFOLIO=PORTFOLIO.filter(p=>p.id!==id);
  savePort();
  renderPortfolio();
}

// ══════════════════════════════════════════
// ── BANK TAQQOSLASH ──
// ══════════════════════════════════════════
let bcDir='sell';
function setBcDir(dir,btn){
  bcDir=dir;
  document.getElementById('bc-sell-btn').classList.toggle('on',dir==='sell');
  document.getElementById('bc-buy-btn').classList.toggle('on',dir==='buy');
  const cur=document.getElementById('bcCur').value;
  document.getElementById('bc-sell-btn').textContent=`📤 ${cur} Sotaman`;
  document.getElementById('bc-buy-btn').textContent=`📥 ${cur} Sotib olaman`;
  doBankComp();
}
function bcqa(v){document.getElementById('bcAmt').value=v;doBankComp();}

function doBankComp(){
  const amt=parseFloat(document.getElementById('bcAmt').value)||0;
  const cur=document.getElementById('bcCur').value;
  const res=document.getElementById('bcResult');
  // Update button labels
  document.getElementById('bc-sell-btn').textContent=`📤 ${cur} Sotaman`;
  document.getElementById('bc-buy-btn').textContent=`📥 ${cur} Sotib olaman`;
  if(!amt||amt<=0){res.innerHTML='';return;}
  const rows=STATE.BANK_RATES[cur]||[];
  if(!rows.length){res.innerHTML=`<div class="ltxt" style="padding:12px">⚠️ Bank kurslari yuklanmagan</div>`;return;}

  const selling=bcDir==='sell'; // Men sotaman = bank sotib oladi
  const dec=cur==='RUB'?2:0;
  const computed=rows.map(b=>{
    const total=selling?Math.round(amt*b.buy):Math.round(amt*b.sell);
    return{name:b.name,rate:selling?b.buy:b.sell,total};
  }).sort((a,b)=>selling?b.total-a.total:a.total-b.total);

  const best=computed[0].total;
  const lbl=selling?'Olasiz (so\'m)':'To\'laysiz (so\'m)';
  res.innerHTML=`
    <div style="font-size:9px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;padding:4px 0 8px">
      ${selling?'Eng ko\'p beradigan':'Eng kam oladigan'} bankdan boshlangan
    </div>
    <div class="bc-list card" style="margin:0">
      ${computed.slice(0,10).map((b,i)=>{
        const diff=selling?b.total-computed[computed.length-1].total:computed[computed.length-1].total-b.total;
        const isBest=i===0;
        return`<div class="bc-row" onclick="copyBankRate('${b.name.replace(/'/g,"\\'")}',${rows.find(r=>r.name===b.name)?.buy||0},${rows.find(r=>r.name===b.name)?.sell||0})">
          <div class="bc-rank">${isBest?'⭐':`${i+1}`}</div>
          <div class="bc-name">${b.name}</div>
          <div style="text-align:right">
            <div class="bc-val" style="${isBest?'color:var(--green)':''}">${fmtFull(b.total)}</div>
            ${diff>0?`<div class="bc-diff">${selling?'+':'−'}${fmtFull(diff)}</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:10px;color:var(--text3);padding:8px 4px 0">💡 Bosib nusxalash mumkin</div>`;
}

// ══════════════════════════════════════════
// ── MAQSAD REJALOVCHI ──
// ══════════════════════════════════════════
function doGoal(){
  const goal=parseFloat(document.getElementById('gGoal').value)||0;
  const now=parseFloat(document.getElementById('gNow').value)||0;
  const monthUZS=parseFloat(document.getElementById('gMonth').value)||0;
  const cur=document.getElementById('gCur').value;
  const res=document.getElementById('gRes');
  if(!goal||goal<=0||!monthUZS||monthUZS<=0){res.classList.remove('on');return;}

  const rate=STATE.CBU[cur]?.rate||(cur==='UZS'?1:STATE.USD_UZS);
  const remain=Math.max(0,goal-now);
  const remainUZS=remain*rate;
  const monthsNeeded=Math.ceil(remainUZS/monthUZS);
  const monthCurVal=(monthUZS/rate).toFixed(2);

  const fin=new Date();
  fin.setMonth(fin.getMonth()+monthsNeeded);
  const months=['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const dateStr=`${months[fin.getMonth()]} ${fin.getFullYear()}`;

  document.getElementById('gMonths').textContent=`${monthsNeeded} oy`;
  document.getElementById('gDate').textContent=dateStr;
  document.getElementById('gMonthCur').textContent=`${monthCurVal} ${cur}`;
  document.getElementById('gRemain').textContent=`${fmtFull(remain,2)} ${cur} (${fmtFull(Math.round(remainUZS))} so'm)`;
  res.classList.add('on');
}

// ══════════════════════════════════════════
// ── FOYDA / ZARAR ──
// ══════════════════════════════════════════
function plCurChange(){plFillCurrent();doProfit();}
function plFillCurrent(){
  const cur=document.getElementById('plCur').value;
  const val=portSymUZS(cur,1);
  if(val&&val>0) document.getElementById('plNowRate').value=Math.round(val);
}
function doProfit(){
  const amt=parseFloat(document.getElementById('plAmt').value)||0;
  const buyRate=parseFloat(document.getElementById('plBuyRate').value)||0;
  const nowRate=parseFloat(document.getElementById('plNowRate').value)||0;
  const res=document.getElementById('plRes');
  if(!amt||amt<=0||!buyRate||!nowRate){res.classList.remove('on');return;}
  const startUZS=amt*buyRate;
  const nowUZS=amt*nowRate;
  const diff=nowUZS-startUZS;
  const pct=((diff/startUZS)*100).toFixed(2);
  const up=diff>=0;
  const cur=document.getElementById('plCur').value;
  document.getElementById('plStart').textContent=fmtFull(Math.round(startUZS))+' so\'m';
  document.getElementById('plNow').textContent=fmtFull(Math.round(nowUZS))+' so\'m';
  document.getElementById('plPnlLbl').textContent=up?'Foyda':'Zarar';
  document.getElementById('plPnl').style.color=up?'var(--green)':'var(--red)';
  document.getElementById('plPnl').textContent=(up?'+':'')+fmtFull(Math.round(diff))+' so\'m';
  document.getElementById('plPct').textContent=(up?'+':'')+pct+'%';
  document.getElementById('plPct').style.color=up?'var(--green)':'var(--red)';
  document.getElementById('plPer').textContent=fmtFull(Math.round(nowRate-buyRate))+' so\'m / '+cur;
  res.classList.add('on');
}

// ══════════════════════════════════════════
// ── OFFLINE KESH ──
// ══════════════════════════════════════════
function saveCache(){
  try{
    if(Object.keys(STATE.CBU).length) localStorage.setItem('bn_cbu_c',JSON.stringify({d:STATE.CBU,t:Date.now()}));
    if(Object.keys(STATE.BANK_RATES).length) localStorage.setItem('bn_bank_c',JSON.stringify({d:STATE.BANK_RATES,t:Date.now()}));
    if(Object.keys(STATE.METALS).length) localStorage.setItem('bn_metals_c',JSON.stringify({d:STATE.METALS,t:Date.now()}));
    if(chartHistory.length) localStorage.setItem('bn_hist_c',JSON.stringify({d:chartHistory,t:Date.now()}));
    if(P2P.buy?.length||P2P.sell?.length) localStorage.setItem('bn_p2p_c',JSON.stringify({d:P2P,t:Date.now()}));
  }catch(_){}
}
function loadCache(){
  const MAX=4*3600*1000; // 4 soat
  const P2P_MAX=30*60*1000; // P2P uchun 30 daqiqa (tez o'zgaradi)
  try{
    const c=localStorage.getItem('bn_cbu_c');
    if(c){const p=JSON.parse(c);if(Date.now()-p.t<MAX){STATE.CBU=p.d;if(STATE.CBU.USD)STATE.USD_UZS=STATE.CBU.USD.rate;renderCBU();}}
    const b=localStorage.getItem('bn_bank_c');
    if(b){const p=JSON.parse(b);if(Date.now()-p.t<MAX){STATE.BANK_RATES=p.d;renderBankTable();}}
    const m=localStorage.getItem('bn_metals_c');
    if(m){const p=JSON.parse(m);if(Date.now()-p.t<MAX){STATE.METALS=p.d;renderMetals();}}
    const h=localStorage.getItem('bn_hist_c');
    if(h){const p=JSON.parse(h);if(Date.now()-p.t<MAX){chartHistory=p.d;renderChartFromHistory();updateChartSummary();if(Object.keys(STATE.CBU).length)renderCBU();}}
    const p2=localStorage.getItem('bn_p2p_c');
    if(p2){const p=JSON.parse(p2);if(Date.now()-p.t<P2P_MAX){P2P=p.d;renderP2P();}}
  }catch(_){}
}

// ── INIT ──
applyLang();
// Telegram tema auto-sinxronlash (faqat Tizimli rejimda)
if(tg){
  tg.onEvent('themeChanged',()=>{
    if(STATE.THEME==='system'){applyTheme();}
    else if(!localStorage.getItem('bn_theme_manual')&&tg.colorScheme){
      STATE.THEME=tg.colorScheme;applyTheme();
    }
  });
}
loadCache();
// Saqlangan STATE.BANK_CUR tab ni aktiv qilish
(()=>{
  const tabs=document.querySelectorAll('#bankCurTabs .stab');
  tabs.forEach(b=>b.classList.toggle('on',b.textContent===STATE.BANK_CUR));
  // Saqlangan STATE.METAL_UNIT ni qo'llash
  document.getElementById('utab-oz')?.classList.toggle('on',STATE.METAL_UNIT==='oz');
  document.getElementById('utab-g')?.classList.toggle('on',STATE.METAL_UNIT==='g');
})();
loadAll();

// Har 5 daqiqada yashirin yangilash — loading spinner ko'rsatmasdan
setInterval(async ()=>{
  await Promise.all([loadCBU(),loadCrypto(),loadMetals()]);
  loadP2P();
  doCalc();
}, 5*60*1000);

// ══════════════════════════════════════════
// ── FIREBASE AUTH ──
// ══════════════════════════════════════════
// Firebase config — Firebase Console dan oling:
// console.firebase.google.com → Project settings → Web app → Config
const _FB_CONFIG={
  apiKey:"AIzaSyBPJqOEn-pYj0sWBF5izo-BY00X6eJlNNo",
  authDomain:"banknews-c4bca.firebaseapp.com",
  projectId:"banknews-c4bca",
  storageBucket:"banknews-c4bca.firebasestorage.app",
  messagingSenderId:"705101581122",
  appId:"1:705101581122:web:e2b9405fbfc4182e5756db",
  measurementId:"G-0N2LYBBBCN"
};

let _fbApp=null,_fbAuth=null,fbUser=null;

function _initFB(){
  if(_FB_CONFIG.apiKey==='YOUR_API_KEY') return false;
  if(_fbApp) return true;
  if(typeof firebase==='undefined'){console.error('Firebase SDK yuklanmadi!');return false;}
  try{
    _fbApp=firebase.initializeApp(_FB_CONFIG);
    _fbAuth=firebase.auth();
    _fbAuth.onAuthStateChanged(u=>{fbUser=u;_syncAuthUI();});
    return true;
  }catch(e){console.error('Firebase init xatosi:',e.code,e.message);return false;}
}

function _syncAuthUI(){
  const btn=document.getElementById('authBtn');
  if(btn){
    if(fbUser){
      const ph=fbUser.photoURL;
      const nm=(fbUser.displayName||fbUser.email||'U');
      btn.classList.add('logged');
      btn.innerHTML=ph?`<img src="${ph}" alt="">`:`<div class="auth-hdr-ph">${nm[0].toUpperCase()}</div>`;
    }else{
      btn.classList.remove('logged');
      btn.innerHTML='👤';
    }
  }
  // Profil tab ochiq bo'lsa yangilash
  const s5=document.getElementById('s5');
  if(s5&&s5.classList.contains('on')) renderProfileTab();
}

function openAuthModal(){
  if(!_initFB()){
    console.warn('Firebase sozlanmagan — auth o\'tkazib yuborildi');
    return;
  }
  _renderAuthContent();
  document.getElementById('authOverlay').classList.add('open');
  document.getElementById('authModal').classList.add('open');
  haptic('impact','medium');
}

function closeAuthModal(){
  document.getElementById('authModal')?.classList.remove('open');
  document.getElementById('authOverlay')?.classList.remove('open');
}

function _renderAuthContent(){
  const el=document.getElementById('authContent');
  if(fbUser) el.innerHTML=_tplProfile();
  else el.innerHTML=_tplLogin();
}

function _tplLogin(){
  const T={
    uz:['BankNews ga kiring','Sozlamalar va ogohlantirishlar saqlanadi'],
    ru:['Войти в BankNews','Настройки и оповещения будут сохранены'],
    en:['Sign in to BankNews','Settings and alerts will be saved across devices']
  };
  const [ttl,sub]=(T[STATE.LANG]||T.uz);
  return`
  <div class="auth-hdr">
    <div class="auth-logo">🏦</div>
    <div class="auth-title">${ttl}</div>
    <div class="auth-sub">${sub}</div>
  </div>
  <div class="auth-btns">
    <button class="auth-google" onclick="signInGoogle()">
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
      </svg>
      Google bilan kiring
    </button>
    <div class="auth-or">yoki</div>
    <button class="auth-apple" onclick="signInApple()">
      <svg width="15" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.1 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.5 135.4-317.1 269-317.1 70.6 0 129.5 46.4 173.1 46.4 42.8 0 109.6-49 192.1-49 20.7 0 102.3 9.4 159.2 71.9zm-234.8-181c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
      </svg>
      Apple bilan kiring
    </button>
  </div>
  <div class="auth-note">Kirish orqali siz <span style="color:var(--gold2)">Maxfiylik siyosati</span>mizga rozilik bildirasiz</div>`;
}

function _tplProfile(){
  const u=fbUser;
  const nm=u.displayName||'Foydalanuvchi';
  const portLen=PORTFOLIO.length;
  const T={
    uz:['Ogohlantirishlar','Sozlamalar','Chiqish'],
    ru:['Оповещения','Настройки','Выйти'],
    en:['Alerts','Settings','Sign out']
  };
  const [alertTx,settTx,outTx]=(T[STATE.LANG]||T.uz);
  return`
  <div class="auth-profile">
    ${u.photoURL
      ?`<img class="auth-avatar" src="${u.photoURL}" alt="">`
      :`<div class="auth-avatar-ph">${nm[0].toUpperCase()}</div>`}
    <div class="auth-pname">${nm}</div>
    <div class="auth-pemail">${u.email||''}</div>
  </div>
  <div class="auth-stats">
    <div class="auth-stat">
      <div class="auth-stat-v">${portLen}</div>
      <div class="auth-stat-l">Portfel</div>
    </div>
    <div class="auth-stat">
      <div class="auth-stat-v" id="alertCount">0</div>
      <div class="auth-stat-l">${alertTx}</div>
    </div>
  </div>
  <div class="auth-menu">
    <div class="auth-menu-item" onclick="openAlerts()">
      <div class="auth-menu-left">
        <div class="auth-menu-ico" style="background:rgba(0,214,143,.12)">🔔</div>
        ${alertTx}
      </div>
      <span class="auth-menu-arr">›</span>
    </div>
    <div class="auth-menu-item" onclick="closeAuthModal()">
      <div class="auth-menu-left">
        <div class="auth-menu-ico" style="background:rgba(212,168,67,.12)">⚙️</div>
        ${settTx}
      </div>
      <span class="auth-menu-arr">›</span>
    </div>
  </div>
  <button class="auth-signout" onclick="doSignOut()">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    ${outTx}
  </button>`;
}

async function signInGoogle(){
  if(!_fbAuth) return;
  try{
    const pr=new firebase.auth.GoogleAuthProvider();
    pr.setCustomParameters({prompt:'select_account'});
    await _fbAuth.signInWithPopup(pr);
    closeAuthModal();
    haptic('notify','success');
    const msg=STATE.LANG==='ru'?'✅ Вы успешно вошли!':STATE.LANG==='en'?'✅ Signed in!':'✅ Muvaffaqiyatli kirdingiz!';
    if(tg) tg.showPopup({message:msg,buttons:[{type:'ok'}]});
    else alert(msg);
  }catch(e){
    if(e.code!=='auth/popup-closed-by-user') alert('Xato: '+e.message);
  }
}

async function signInApple(){
  if(!_fbAuth) return;
  try{
    const pr=new firebase.auth.OAuthProvider('apple.com');
    pr.addScope('email');pr.addScope('name');
    await _fbAuth.signInWithPopup(pr);
    closeAuthModal();
    haptic('notify','success');
    const msg=STATE.LANG==='ru'?'✅ Вы успешно вошли!':STATE.LANG==='en'?'✅ Signed in!':'✅ Muvaffaqiyatli kirdingiz!';
    if(tg) tg.showPopup({message:msg,buttons:[{type:'ok'}]});
    else alert(msg);
  }catch(e){
    if(e.code!=='auth/popup-closed-by-user') alert('Xato: '+e.message);
  }
}

async function doSignOut(){
  try{ await _fbAuth.signOut();closeAuthModal(); }catch(_){}
}

function openAlerts(){
  closeAuthModal();
  goTab(5);
}

// ══════════════════════════════════════════
// PROFILE & ADMIN TAB
// ══════════════════════════════════════════

const ADMIN_EMAILS=['sherzodbekhome@gmail.com'];
let FAVORITES=JSON.parse(localStorage.getItem('bn_favorites')||'["USD","EUR","RUB"]');
let _userAlerts=[];

function isAdmin(){return fbUser&&ADMIN_EMAILS.includes(fbUser.email);}

function saveFavorites(){localStorage.setItem('bn_favorites',JSON.stringify(FAVORITES));}

function toggleFavorite(cur){
  haptic('impact','light');
  const idx=FAVORITES.indexOf(cur);
  if(idx>=0) FAVORITES.splice(idx,1); else FAVORITES.push(cur);
  saveFavorites();
  document.querySelectorAll('.fav-pill').forEach(el=>el.classList.toggle('on',FAVORITES.includes(el.dataset.cur)));
}

function renderProfileTab(){
  const root=document.getElementById('profileRoot');
  if(!root) return;
  if(!fbUser){root.innerHTML=_tplGuestProfile();return;}
  _renderUserProfile(root);
  loadAdminStats();
}

function _tplGuestProfile(){
  return`<div class="pgst">
    <div class="pgst-ico">🔐</div>
    <div class="pgst-title">Hisobingizga kiring</div>
    <div class="pgst-sub">Valyuta ogohlantirish, sevimli valyutalar va portfel sinxronizatsiyasi uchun kirish talab etiladi.</div>
    <div class="pgst-btns">
      <button class="auth-btn google" onclick="openAuthModal()" style="width:100%;padding:13px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--glass-border);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;font-family:'Inter',sans-serif">
        <svg width="17" height="17" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Google orqali kirish
      </button>
    </div>
  </div>`;
}

function _renderUserProfile(root){
  const u=fbUser;
  const nm=u.displayName||u.email||'Foydalanuvchi';
  const initials=nm[0].toUpperCase();
  const provider=(u.providerData&&u.providerData[0])||{};
  const providerLabel=provider.providerId==='apple.com'?'🍎 Apple':'🔵 Google';
  const favCurs=['USD','EUR','RUB','GBP','CNY','KZT','TRY','BTC','ETH','USDT','XAU','JPY'];
  root.innerHTML=`<div style="padding:0 0 80px">
    <div class="pcard">
      ${u.photoURL?`<img class="pcard-av" src="${u.photoURL}" alt="">`:`<div class="pcard-av-ph">${initials}</div>`}
      <div style="flex:1;min-width:0">
        <div class="pcard-name">${nm}</div>
        <div class="pcard-email">${u.email||''}</div>
        <div class="pcard-badge">${providerLabel} orqali ulangan</div>
      </div>
      ${isAdmin()?'<div class="admin-badge">🛡 Admin</div>':''}
    </div>

    <div class="psec">
      <div class="psec-h">
        <div class="psec-title">⭐ Sevimli Valyutalar</div>
      </div>
      <div class="fav-grid">
        ${favCurs.map(c=>`<button class="fav-pill${FAVORITES.includes(c)?' on':''}" data-cur="${c}" onclick="toggleFavorite('${c}')" style="display:inline-flex;align-items:center;gap:5px">${FL[c]?_flagImg(c,20,13):''} ${c}</button>`).join('')}
      </div>
    </div>

    <div class="psec">
      <div class="psec-h">
        <div class="psec-title">🔔 Valyuta Ogohlantirishlari</div>
        <button class="psec-btn" onclick="showAlertForm()">＋ Qo'shish</button>
      </div>
      <div class="alert-list" id="alertList"><div style="padding:12px 14px;font-size:12px;color:var(--text3)">Yuklanmoqda...</div></div>
      <div class="alert-form" id="alertForm" style="display:none">
        <div class="alert-form-row">
          <select class="asel" id="alertCur">
            <option value="USD">🇺🇸 USD</option><option value="EUR">🇪🇺 EUR</option>
            <option value="RUB">🇷🇺 RUB</option><option value="GBP">🇬🇧 GBP</option>
            <option value="CNY">🇨🇳 CNY</option><option value="KZT">🇰🇿 KZT</option>
          </select>
          <select class="asel" id="alertDir">
            <option value="above">⬆ Yuqori</option>
            <option value="below">⬇ Quyi</option>
          </select>
        </div>
        <div class="alert-form-row">
          <input class="ainput" type="number" id="alertThr" placeholder="Narx chegarasi (so'm)" style="flex:1">
        </div>
        <button class="alert-save" onclick="submitAlert()">💾 Saqlash</button>
      </div>
    </div>

    <div class="psec">
      <div class="psec-h"><div class="psec-title">☁ Portfel Sinxronizatsiyasi</div></div>
      <div class="sync-row">
        <button class="sync-btn up" onclick="syncPortfolioUp()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Serverga yuklash ↑
        </button>
        <button class="sync-btn dn" onclick="syncPortfolioDown()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Qurilmaga tiklash ↓
        </button>
      </div>
      <div id="syncStatus" style="padding:0 14px 12px;font-size:11px;color:var(--text3)"></div>
    </div>

    <button class="p-signout" onclick="doSignOut()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Hisobdan chiqish
    </button>

    ${isAdmin()?_tplAdminSection():''}
  </div>`;
  _fetchAlerts();
}

function showAlertForm(){
  const f=document.getElementById('alertForm');
  if(f) f.style.display=f.style.display==='none'?'block':'none';
}

async function _fetchAlerts(){
  if(!fbUser) return;
  try{
    const tok=await fbUser.getIdToken();
    const r=await fetch('/api/user/alerts',{headers:{Authorization:'Bearer '+tok}});
    const d=await r.json();
    if(d.ok){_userAlerts=d.alerts||[];_renderAlertList();}
  }catch(e){
    const el=document.getElementById('alertList');
    if(el) el.innerHTML='<div style="padding:12px 14px;font-size:12px;color:var(--text3)">Server bilan ulanish yo\'q</div>';
  }
}

function _renderAlertList(){
  const el=document.getElementById('alertList');
  if(!el) return;
  if(!_userAlerts.length){
    el.innerHTML='<div style="padding:12px 14px;font-size:12px;color:var(--text3)">Hali ogohlantirish yo\'q. ＋ Qo\'shish tugmasini bosing.</div>';
    return;
  }
  el.innerHTML=_userAlerts.map(a=>`
    <div class="alert-item">
      <div class="alert-ico">${a.direction==='above'?'📈':'📉'}</div>
      <div class="alert-info">
        <span style="font-weight:700;color:var(--text)">${a.currency}</span>
        <span style="color:var(--text2)"> ${a.direction==='above'?'≥':'≤'} </span>
        <span style="font-family:'JetBrains Mono',monospace;color:var(--gold2)">${fmt(a.threshold,0)} so'm</span>
      </div>
      <button class="alert-del" onclick="deleteAlert(${a.id})">✕</button>
    </div>`).join('');
}

async function submitAlert(){
  if(!fbUser) return;
  const cur=document.getElementById('alertCur')?.value||'USD';
  const dir=document.getElementById('alertDir')?.value||'above';
  const thr=parseFloat(document.getElementById('alertThr')?.value||'0');
  if(!thr||thr<=0){alert('Narx kiriting');return;}
  try{
    const tok=await fbUser.getIdToken();
    const r=await fetch('/api/user/alerts',{
      method:'POST',
      headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},
      body:JSON.stringify({currency:cur,direction:dir,threshold:thr})
    });
    const d=await r.json();
    if(d.ok){
      haptic('notify','success');
      const inp=document.getElementById('alertThr');
      if(inp) inp.value='';
      const form=document.getElementById('alertForm');
      if(form) form.style.display='none';
      await _fetchAlerts();
    }
  }catch(e){alert('Xato: '+e.message);}
}

async function deleteAlert(id){
  if(!fbUser) return;
  try{
    const tok=await fbUser.getIdToken();
    await fetch('/api/user/alerts',{
      method:'DELETE',
      headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},
      body:JSON.stringify({id})
    });
    haptic('impact','medium');
    await _fetchAlerts();
  }catch(e){}
}

async function syncPortfolioUp(){
  if(!fbUser){openAuthModal();return;}
  const ss=document.getElementById('syncStatus');
  if(ss) ss.textContent='Yuklanmoqda...';
  try{
    const tok=await fbUser.getIdToken();
    const r=await fetch('/api/user/portfolio',{
      method:'POST',
      headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},
      body:JSON.stringify({portfolio:PORTFOLIO})
    });
    const d=await r.json();
    if(ss) ss.textContent=d.ok?'✅ Serverga yuklandi — '+new Date().toLocaleTimeString():'❌ '+(d.error||'Xato');
    if(d.ok) haptic('notify','success');
  }catch(e){if(ss) ss.textContent='❌ Ulanish xatosi';}
}

async function syncPortfolioDown(){
  if(!fbUser){openAuthModal();return;}
  const ss=document.getElementById('syncStatus');
  if(ss) ss.textContent='Yuklanmoqda...';
  try{
    const tok=await fbUser.getIdToken();
    const r=await fetch('/api/user/portfolio',{headers:{Authorization:'Bearer '+tok}});
    const d=await r.json();
    if(d.ok&&d.portfolio){
      PORTFOLIO=d.portfolio;
      localStorage.setItem('bn_portfolio',JSON.stringify(PORTFOLIO));
      haptic('notify','success');
      if(ss) ss.textContent='✅ Qurilmaga tiklandi — '+new Date().toLocaleTimeString();
    } else {
      if(ss) ss.textContent=d.error||'Server portfeli bo\'sh';
    }
  }catch(e){if(ss) ss.textContent='❌ Ulanish xatosi';}
}

function _tplAdminSection(){
  return`<div style="margin-top:4px">
    <div style="padding:18px 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--red)">⚡ Admin Panel</div>
    <div class="psec">
      <div class="psec-h">
        <div class="psec-title">📊 Statistika</div>
        <button class="psec-btn" onclick="loadAdminStats()">↻ Yangilash</button>
      </div>
      <div class="admin-stats-grid">
        <div class="adstat"><div class="adstat-v" id="statUsers">—</div><div class="adstat-l">Web foydalanuvchi</div></div>
        <div class="adstat"><div class="adstat-v" id="statAlerts">—</div><div class="adstat-l">Ogohlantirishlar</div></div>
        <div class="adstat"><div class="adstat-v" id="statTgUsers">—</div><div class="adstat-l">Bot obunachilar</div></div>
      </div>
    </div>
    <div class="psec">
      <div class="psec-h"><div class="psec-title">📢 Broadcast Xabar</div></div>
      <div style="padding:10px 12px 12px">
        <textarea class="admin-ta" id="bcText" placeholder="Barcha foydalanuvchilarga xabar..."></textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <select class="asel" id="bcLang" style="flex:1">
            <option value="all">Barcha tillar</option>
            <option value="uz">Faqat O'zbekcha</option>
            <option value="ru">Только Русский</option>
          </select>
          <button class="bc-send-btn" onclick="sendBroadcast()">📤 Yuborish</button>
        </div>
        <div id="bcStatus" style="font-size:11px;color:var(--text3);margin-top:8px"></div>
      </div>
    </div>
    <div class="psec">
      <div class="psec-h"><div class="psec-title">💱 Kurs Boshqaruvi</div></div>
      <div style="padding:10px 12px 12px">
        <div class="rate-form-row">
          <select class="asel rate-cur" id="rateCur">
            <option value="USD">USD</option><option value="EUR">EUR</option><option value="RUB">RUB</option>
          </select>
          <input class="rate-in" type="number" id="rateBuy" placeholder="Sotib olish">
          <input class="rate-in" type="number" id="rateSell" placeholder="Sotish">
          <button class="rate-sv" onclick="saveAdminRate()">✓</button>
        </div>
        <div id="rateStatus" style="font-size:11px;color:var(--text3);margin-top:8px"></div>
      </div>
    </div>
  </div>`;
}

async function loadAdminStats(){
  if(!fbUser||!isAdmin()) return;
  try{
    const tok=await fbUser.getIdToken();
    const r=await fetch('/api/admin/stats',{headers:{Authorization:'Bearer '+tok}});
    const d=await r.json();
    if(d.ok){
      ['statUsers','statAlerts','statTgUsers'].forEach((id,i)=>{
        const vals=[d.web_users,d.alerts,d.tg_users];
        const el=document.getElementById(id);
        if(el) el.textContent=vals[i]??'—';
      });
    }
  }catch(e){}
}

async function sendBroadcast(){
  if(!fbUser||!isAdmin()) return;
  const txt=document.getElementById('bcText')?.value?.trim();
  if(!txt){alert('Xabar kiriting');return;}
  const lang=document.getElementById('bcLang')?.value||'all';
  const st=document.getElementById('bcStatus');
  if(st) st.textContent='Yuborilmoqda...';
  try{
    const tok=await fbUser.getIdToken();
    const r=await fetch('/api/admin/broadcast',{
      method:'POST',
      headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},
      body:JSON.stringify({text:txt,lang})
    });
    const d=await r.json();
    if(st) st.textContent=d.ok?`✅ ${d.sent||0} ta xabar yuborildi`:'❌ '+(d.error||'Xato');
    if(d.ok){haptic('notify','success');const el=document.getElementById('bcText');if(el)el.value='';}
  }catch(e){if(st) st.textContent='❌ Ulanish xatosi';}
}

async function saveAdminRate(){
  if(!fbUser||!isAdmin()) return;
  const cur=document.getElementById('rateCur')?.value||'USD';
  const buy=parseFloat(document.getElementById('rateBuy')?.value||'0');
  const sell=parseFloat(document.getElementById('rateSell')?.value||'0');
  if(!buy||!sell){alert('Kurs kiriting');return;}
  const st=document.getElementById('rateStatus');
  try{
    const tok=await fbUser.getIdToken();
    const r=await fetch('/api/admin/rate',{
      method:'POST',
      headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},
      body:JSON.stringify({currency:cur,buy,sell})
    });
    const d=await r.json();
    if(st) st.textContent=d.ok?'✅ Saqlandi':'❌ '+(d.error||'Xato');
  }catch(e){if(st) st.textContent='❌ Ulanish xatosi';}
}

// ── PREMIUM TARIF ──
function selectPlan(el){
  haptic('select');
  document.querySelectorAll('.prem-plan').forEach(p=>p.classList.remove('on'));
  el.classList.add('on');
}

// ── SOZLAMALAR ──
function renderSozlamalar(){
  applyLang();
  applyTheme();
  // Profil holati
  const pname=document.getElementById('sozProfileName');
  const psub=document.getElementById('sozProfileSub');
  if(fbUser){
    if(pname) pname.textContent=fbUser.displayName||fbUser.email||'Foydalanuvchi';
    if(psub) psub.textContent='Profil va ogohlantirishlarni boshqarish';
  } else {
    if(pname) pname.textContent='Tizimga kiring';
    if(psub) psub.textContent='Profilingizni ko\'rish va boshqarish';
  }
}

function openLangSheet(){
  haptic('impact','light');
  document.getElementById('langSheetOverlay').classList.add('open');
  document.getElementById('langSheet').classList.add('open');
  updateLangRadios();
}
function closeLangSheet(){
  document.getElementById('langSheetOverlay').classList.remove('open');
  document.getElementById('langSheet').classList.remove('open');
}
function updateLangRadios(){
  LANG_CODES.forEach(c=>{
    const el=document.getElementById('lrad-'+c);
    if(el)el.classList.toggle('on',STATE.LANG===c);
  });
}
function setLangOption(lang){
  haptic('select');
  STATE.LANG=lang;
  localStorage.setItem('bn_lang',lang);
  updateLangRadios();
  applyLang();
  setTimeout(closeLangSheet,260);
  if(Object.keys(STATE.CBU).length) renderCBU();
  if(Object.keys(STATE.CRYPTO).length) renderCrypto();
  if(Object.keys(STATE.METALS).length) renderMetals();
  if(Object.keys(STATE.BANK_RATES).length) renderBankTable();
}

// ── STAVKA SOLISHTIRISH ──
function doStavkaDep(){
  const amt=parseFloat(document.getElementById('sdAmt')?.value)||0;
  const months=parseInt(document.getElementById('sdMonth')?.value)||0;
  const el=document.getElementById('sdResult');
  if(!el) return;
  if(!amt||!months){el.innerHTML='';return;}
  const results=DEP_BANKS.map(b=>{
    const profit=amt*(b.dep/100)*(months/12);
    return{...b,profit,total:amt+profit};
  }).sort((a,b)=>b.profit-a.profit);
  el.innerHTML=`<div class="stavka-list">${results.map((b,i)=>{
    const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    const minOk=amt>=b.minAmt;
    return`<div class="stavka-card${i===0?' best':''}">
      <div class="stavka-rank">${medal||i+1}</div>
      <div class="stavka-info">
        <div class="stavka-name">${b.name}</div>
        <div class="stavka-rate">${b.dep}% yillik${!minOk?` · min ${fmtFull(b.minAmt)} so'm`:''}</div>
      </div>
      <div class="stavka-nums">
        <div class="stavka-profit">+${fmtFull(Math.round(b.profit))} so'm</div>
        <div class="stavka-total">${fmtFull(Math.round(b.total))} so'm</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function doStavkaKred(){
  const amt=parseFloat(document.getElementById('skAmt')?.value)||0;
  const months=parseInt(document.getElementById('skMonth')?.value)||0;
  const el=document.getElementById('skResult');
  if(!el) return;
  if(!amt||!months){el.innerHTML='';return;}
  const results=KRED_BANKS.filter(b=>amt<=b.max).map(b=>{
    const r=b.kred/100/12;
    const monthly=r===0?amt/months:amt*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1);
    const total=monthly*months;
    const overpay=total-amt;
    return{...b,monthly,total,overpay};
  }).sort((a,b)=>a.monthly-b.monthly);
  if(!results.length){
    el.innerHTML=`<div class="stavka-empty">Bu summa uchun mos bank topilmadi</div>`;
    return;
  }
  el.innerHTML=`<div class="stavka-list">${results.map((b,i)=>{
    const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return`<div class="stavka-card${i===0?' best':''}">
      <div class="stavka-rank">${medal||i+1}</div>
      <div class="stavka-info">
        <div class="stavka-name">${b.name}</div>
        <div class="stavka-rate">${b.kred}% · ustama ${fmtFull(Math.round(b.overpay))} so'm</div>
      </div>
      <div class="stavka-nums">
        <div class="stavka-profit">${fmtFull(Math.round(b.monthly))} so'm</div>
        <div class="stavka-total">oylik to'lov</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ── AI TAHLIL ──
let _aiCache=null;
let _aiCacheTs=0;
const _AI_TTL=5*60*1000; // 5 daqiqa

// Gemini API ni to'g'ridan-to'g'ri chaqirish (backend yo'q bo'lganda)
const _DEFAULT_GEMINI_KEY='';
async function _callGeminiDirect(prompt){
  const key=localStorage.getItem('bn_gemini_key')||_DEFAULT_GEMINI_KEY;
  const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),20000);
  const r=await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:600,temperature:0.7}}),
     signal:ac.signal}
  );
  clearTimeout(tid);
  const d=await r.json();
  if(d.error) throw new Error(d.error.message||'Gemini xatosi');
  return d.candidates?.[0]?.content?.parts?.[0]?.text||null;
}

function _buildMarketPrompt(){
  const rates=[];
  ['USD','EUR','RUB','GBP','CNY'].forEach(c=>{if(STATE.CBU[c]) rates.push(`${c}: ${fmtFull(STATE.CBU[c].rate,c==='RUB'?2:0)} so'm`);});
  const cryptos=[];
  ['BTC','ETH','BNB','SOL','USDT'].forEach(s=>{
    if(STATE.CRYPTO[s]) cryptos.push(`${s}: $${STATE.CRYPTO[s].usd>=1?fmt(STATE.CRYPTO[s].usd,2):STATE.CRYPTO[s].usd.toFixed(4)} (${(STATE.CRYPTO[s].change||0).toFixed(2)}%)`);
  });
  return`O'zbekiston valyuta bozori haqida qisqa professional tahlil yoz (4-5 ta gap, o'zbek tilida, oddiy foydalanuvchiga tushunarli):

Markaziy bank kurslari: ${rates.join(', ')||'ma\'lumot yo\'q'}
Kripto bozor: ${cryptos.join(', ')||'ma\'lumot yo\'q'}

Bozor holati, o'sish yoki tushish tendensiyasi, USD/UZS prognozi va qisqa maslahat ber.`;
}

function _aiShowKeyPrompt(root){
  root.innerHTML=`
    <div class="ai-hero" style="padding:20px 16px 16px">
      <div class="ai-badge"><svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>Gemini AI</div>
      <div class="ai-title">Bozor Tahlili</div>
    </div>
    <div style="padding:12px 16px 80px">
      <div style="background:var(--surface);border:1px solid var(--glass-border);border-radius:16px;padding:20px">
        <div style="font-size:24px;text-align:center;margin-bottom:12px">🔑</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);text-align:center;margin-bottom:6px">Gemini API Key kerak</div>
        <div style="font-size:12px;color:var(--text2);text-align:center;margin-bottom:18px;line-height:1.6">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#ffb300">aistudio.google.com</a> dan bepul API key oling
        </div>
        <input id="aiKeyInput" type="text" placeholder="AIza..."
          style="width:100%;padding:11px 14px;background:var(--bg2);border:1.5px solid var(--glass-border);border-radius:12px;color:var(--text);font-size:13px;outline:none;box-sizing:border-box;margin-bottom:10px"
          onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor='var(--glass-border)'">
        <button onclick="
          const k=document.getElementById('aiKeyInput').value.trim();
          if(!k){return;}
          localStorage.setItem('bn_gemini_key',k);
          renderAITahlil(true);
        " style="width:100%;padding:12px;background:linear-gradient(135deg,#ffb300,#ff9500);border:none;border-radius:12px;color:#000;font-weight:800;font-size:13px;cursor:pointer">
          Saqlash va tahlil qilish
        </button>
      </div>
    </div>`;
}

async function renderAITahlil(force=false){
  const root=document.getElementById('aiRoot');
  if(!root) return;

  const now=Date.now();
  if(!force && _aiCache && (now-_aiCacheTs)<_AI_TTL){
    _aiShowResult(root,_aiCache);
    return;
  }

  root.innerHTML=`
    <div class="ai-hero" style="padding:20px 16px 16px">
      <div class="ai-badge"><svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>Gemini AI</div>
      <div class="ai-title">Bozor Tahlili</div>
      <div class="ai-sub">Real vaqt ma'lumotlariga asoslangan AI xulosasi</div>
    </div>
    <div style="padding:12px 14px 80px">
      <div class="ai-loading">
        <div class="ai-spinner"></div>
        <div style="font-size:13px;color:var(--text2)">AI tahlil tayyorlanmoqda...</div>
        <div style="font-size:11px;color:var(--text3)">Bu 10-15 soniya vaqt olishi mumkin</div>
      </div>
    </div>`;

  // 1. Backend urinish
  try{
    const ac=new AbortController(),tid=setTimeout(()=>ac.abort(),8000);
    const r=await fetch('/api/ai/analyze',{signal:ac.signal});
    clearTimeout(tid);
    const d=await r.json();
    if(d.ok && d.analysis){
      _aiCache={analysis:d.analysis,signals:d.signals,ts:d.ts};
      _aiCacheTs=now;
      _aiShowResult(root,_aiCache);
      return;
    }
  }catch(_){}

  // 2. Fallback — Gemini API to'g'ridan-to'g'ri
  try{
    // Ma'lumot yuklanmagan bo'lsa, avval yuklaymiz
    if(!STATE.CBU.USD){try{await loadCBU();}catch(_){}}
    if(!STATE.CRYPTO.BTC){try{await loadCrypto();}catch(_){}}
    const analysis=await _callGeminiDirect(_buildMarketPrompt());
    if(analysis){
      const data={analysis,signals:{buy:'—',sell:'—',hold:'—'},ts:Math.floor(now/1000)};
      _aiCache=data;_aiCacheTs=now;
      _aiShowResult(root,data);
    } else {
      _aiShowError(root,'Javob kelmadi');
    }
  }catch(e){
    if(e.message==='no_key') _aiShowKeyPrompt(root);
    else _aiShowError(root,e.message||'Ulanish xatosi');
  }
}

function _aiShowResult(root,data){
  const sig=data.signals||{buy:'—',sell:'—',hold:'—'};
  const ts=data.ts?new Date(data.ts*1000).toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'}):'—';
  // Tahlil matnini paragraflashtirish
  const paras=(data.analysis||'').split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('');

  root.innerHTML=`
    <div class="ai-hero" style="padding:20px 16px 16px">
      <div class="ai-badge"><svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>Gemini AI · ${ts}</div>
      <div class="ai-title">Bozor Tahlili</div>
      <div class="ai-sub">Real vaqt ma'lumotlariga asoslangan AI xulosasi</div>
    </div>
    <div style="padding:12px 14px 80px">
      <!-- Signallar -->
      <div class="ai-card">
        <div class="ai-card-hdr">
          <div class="ai-card-title">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--green)" stroke-width="1.5"/><path d="M4 6l1.5 1.5L8 4" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round"/></svg>
            Bozor signallari
          </div>
        </div>
        <div class="ai-signal">
          <div class="ai-sig-item">
            <div class="ai-sig-val" style="color:var(--green)">${sig.buy}</div>
            <div class="ai-sig-lbl">Sotib olish</div>
          </div>
          <div class="ai-sig-item">
            <div class="ai-sig-val" style="color:var(--gold)">${sig.hold}</div>
            <div class="ai-sig-lbl">Kutish</div>
          </div>
          <div class="ai-sig-item">
            <div class="ai-sig-val" style="color:var(--red)">${sig.sell}</div>
            <div class="ai-sig-lbl">Sotish</div>
          </div>
        </div>
      </div>
      <!-- Tahlil matni -->
      <div class="ai-card">
        <div class="ai-card-hdr">
          <div class="ai-card-title">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2" width="9" height="8" rx="1.5" stroke="var(--purple)" stroke-width="1.5"/><path d="M3.5 5h5M3.5 7.5h3" stroke="var(--purple)" stroke-width="1.2" stroke-linecap="round"/></svg>
            AI xulosasi
          </div>
        </div>
        <div class="ai-body">${paras||'Tahlil mavjud emas'}</div>
      </div>
      <!-- Yangilash -->
      <button class="ai-refresh-btn" onclick="renderAITahlil(true)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7a5 5 0 1 1-1.5-3.54" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="12,2 12,5.5 8.5,5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Yangilash
      </button>
      <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:10px">AI tahlil har 5 daqiqada yangilanadi. Bu moliyaviy maslahat emas.</div>
    </div>`;
}

function _aiShowError(root,msg){
  root.innerHTML=`
    <div class="ai-hero" style="padding:20px 16px 16px">
      <div class="ai-badge"><svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>Gemini AI</div>
      <div class="ai-title">Bozor Tahlili</div>
    </div>
    <div style="padding:24px 14px 80px;text-align:center">
      <div style="font-size:32px;margin-bottom:12px">⚠️</div>
      <div style="font-size:14px;color:var(--text);margin-bottom:6px;font-weight:600">Tahlil yuklanmadi</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:20px">${msg}</div>
      <button class="ai-refresh-btn" onclick="renderAITahlil(true)">Qayta urinish</button>
    </div>`;
}

// Firebase ni dastur boshlanganda ishga tushirish
_initFB();