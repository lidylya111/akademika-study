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
const GRADE_SUBJECTS = {
  '1': [
    {id:'russian', title:'Русский язык', emoji:'✏️'},
    {id:'math', title:'Математика', emoji:'➗'},
    {id:'world', title:'Окружающий мир', emoji:'🌍'},
    {id:'literature', title:'Литература', emoji:'📚'}
  ],
  '2': [
    {id:'russian', title:'Русский язык', emoji:'✏️'},
    {id:'math', title:'Математика', emoji:'➗'},
    {id:'world', title:'Окружающий мир', emoji:'🌍'},
    {id:'literature', title:'Литература', emoji:'📚'}
  ],
  '3': [
    {id:'russian', title:'Русский язык', emoji:'✏️'},
    {id:'math', title:'Математика', emoji:'➗'},
    {id:'world', title:'Окружающий мир', emoji:'🌍'},
    {id:'literature', title:'Литература', emoji:'📚'}
  ],
  '4': [
    {id:'russian', title:'Русский язык', emoji:'✏️'},
    {id:'math', title:'Математика', emoji:'➗'},
    {id:'world', title:'Окружающий мир', emoji:'🌍'},
    {id:'literature', title:'Литература', emoji:'📚'}
  ],
  '5': [
    {id:'russian', title:'Русский язык', emoji:'✏️'},
    {id:'math', title:'Математика', emoji:'➗'},
    {id:'history', title:'История', emoji:'🏺'},
    {id:'biology', title:'Биология', emoji:'🌱'},
    {id:'geography', title:'География', emoji:'🌎'}
  ]
};
const GEOGRAPHY_5_TOPICS = [
  {
    id: "geo5-discoveries",
    number: "§1–7",
    title: "Эпоха Великих географических открытий",
    emoji: "🌍",
    short: "От первых представлений о Земле до спутников и современной географии.",
    facts: [
      "Как менялись представления людей о Земле.",
      "Главные путешественники и географические открытия.",
      "Как географы исследуют Землю сегодня."
    ],
    materials: [],
    tasks: [

      {
        id: "geo-disc-1",
        type: "choice",
        title: "Что изучает география?",
        question: "Какой вариант наиболее полно показывает предмет изучения географии?",
        options: [
          "Только страны и столицы",
          "Географические объекты, явления и процессы",
          "Только погоду и климат",
          "Только путешествия и открытия"
        ],
        correct: 1,
        hint: "Вспомни: гора — объект, наводнение — явление, разрушение горных пород — процесс.",
        explanation: "География изучает географические объекты, явления и процессы, связанные с природой и деятельностью людей."
      },

      {
        id: "geo-disc-2",
        type: "match",
        title: "Учёные Древней Греции",
        question: "Соедини учёного с его вкладом в развитие географии.",
        pairs: [
          ["Аристотель", "Привёл доказательства шарообразности Земли"],
          ["Эратосфен", "Вычислил размеры Земли и использовал слово «географика»"],
          ["Птолемей", "Создал более совершенную карту известного мира"],
          ["Страбон", "Создал большой труд «География»"]
        ],
        hint: "Один учёный доказывал форму Земли, другой измерял её, третий создавал карту.",
        explanation: "Античные учёные постепенно превратили знания о Земле из рассказов и мифов в научные наблюдения и измерения."
      },

      {
        id: "geo-disc-3",
        type: "choice",
        title: "Шарообразность Земли",
        question: "Какое наблюдение помогло Аристотелю сделать вывод о шарообразности Земли?",
        options: [
          "Во время лунного затмения тень Земли имеет дугообразную форму",
          "Все реки текут на юг",
          "Солнце каждое утро появляется на одном месте",
          "Море всегда остаётся неподвижным"
        ],
        correct: 0,
        hint: "Аристотель наблюдал не только Землю, но и то, какую тень она отбрасывает.",
        explanation: "Во время лунного затмения Земля отбрасывает округлую тень, что стало одним из доказательств её шарообразности."
      },

      {
        id: "geo-disc-4",
        type: "choice",
        title: "Средние века",
        question: "Почему арабские учёные сыграли важную роль в развитии географии в Средние века?",
        options: [
          "Они уничтожили труды античных учёных",
          "Они сохранили и перевели античные знания и дополнили их сведениями путешественников",
          "Они первыми открыли Америку",
          "Они доказали, что Земля плоская"
        ],
        correct: 1,
        hint: "Вспомни судьбу сочинений античных учёных на арабском Востоке.",
        explanation: "Арабские учёные переводили и сохраняли античные труды, а путешественники собирали новые сведения о странах и народах."
      },

      {
        id: "geo-disc-5",
        type: "match",
        title: "Путешественники Средневековья",
        question: "Соедини путешественника с наиболее подходящим описанием.",
        pairs: [
          ["Марко Поло", "Путешествовал по странам Азии и долгое время находился в Китае"],
          ["Афанасий Никитин", "Побывал в Индии и оставил описание путешествия"],
          ["Ибн-Батута", "Почти четверть века путешествовал по Африке и Азии"]
        ],
        hint: "Один особенно связан с Китаем, другой — с Индией, третий совершил огромный путь по многим странам.",
        explanation: "Путешествия Средневековья значительно расширили представления людей о далёких странах."
      },

      {
        id: "geo-disc-6",
        type: "choice",
        title: "Начало Великих открытий",
        question: "Почему европейцы в XV веке особенно стремились найти морской путь в Индию?",
        options: [
          "Хотели найти место для строительства европейских столиц",
          "Сухопутный путь к товарам Востока был долгим и трудным",
          "Индия была единственной страной с пресной водой",
          "Европейцам запретили пользоваться морями"
        ],
        correct: 1,
        hint: "Вспомни дорогие пряности и длинные торговые пути.",
        explanation: "Товары Востока, особенно пряности, были очень ценными, а существующий сухопутный путь был долгим, сложным и дорогим."
      },

      {
        id: "geo-disc-7",
        type: "order",
        title: "Хронология открытий",
        question: "Расположи путешественников по времени их главных экспедиций — от более ранней к более поздней.",
        items: [
          "Бартоломеу Диаш",
          "Христофор Колумб",
          "Васко да Гама",
          "Фернан Магеллан"
        ],
        hint: "Диаш обогнул Африку раньше открытия Америки. Первое кругосветное плавание началось позже.",
        explanation: "Диаш — 1487 г., Колумб — 1492 г., да Гама достиг Индии в 1498 г., экспедиция Магеллана началась в 1519 г."
      },

      {
        id: "geo-disc-8",
        type: "choice",
        title: "Христофор Колумб",
        question: "Колумб плыл на запад, рассчитывая достичь Индии. Что произошло на самом деле?",
        options: [
          "Он достиг Антарктиды",
          "Он достиг земель Америки, но считал их частью Индии",
          "Он первым обогнул Африку",
          "Он совершил первое кругосветное плавание"
        ],
        correct: 1,
        hint: "Колумб до конца жизни не осознал значение своего открытия.",
        explanation: "В 1492 году экспедиция Колумба достигла берегов Америки, но сам путешественник считал новые земли частью Азии."
      },

      {
        id: "geo-disc-9",
        type: "multi",
        title: "Последствия Великих открытий",
        question: "Выбери последствия Великих географических открытий.",
        options: [
          "Расширились знания о материках и океанах",
          "Развивались морская торговля и науки",
          "Началось освоение и колонизация новых территорий",
          "Люди перестали составлять географические карты"
        ],
       correct: [0, 1, 2],
        hint: "Подумай и о развитии науки, и о последствиях европейского освоения новых земель.",
        explanation: "Открытия расширили географические знания и торговлю, но одновременно сопровождались захватом территорий и тяжёлыми последствиями для коренных народов."
      },

      {
        id: "geo-disc-10",
        type: "match",
        title: "Исследования XVII–XIX веков",
        question: "Соедини путешественника или экспедицию с достижением.",
        pairs: [
          ["Френсис Дрейк", "Совершил второе кругосветное плавание"],
          ["Абель Тасман", "Исследовал земли в районе Австралии и Новой Зеландии"],
          ["Джеймс Кук", "Исследовал Тихий океан и восточное побережье Австралии"],
          ["Беллинсгаузен и Лазарев", "Открыли Антарктиду"]
        ],
        hint: "Антарктида была открыта русской экспедицией, а Австралия долго исследовалась голландцами и англичанами.",
        explanation: "После эпохи первых великих открытий исследование Земли продолжалось: уточнялись очертания материков, открывались острова и полярные земли."
      },

      {
        id: "geo-disc-11",
        type: "match",
        title: "Российские землепроходцы",
        question: "Соедини путешественника с его вкладом.",
        pairs: [
          ["Ермак Тимофеевич", "Положил начало продвижению русских землепроходцев в Сибирь"],
          ["Иван Москвитин", "Вышел к берегам Охотского моря"],
          ["Семён Дежнёв", "Прошёл проливом между Азией и Америкой"],
          ["Ерофей Хабаров", "Исследовал и осваивал земли в районе Амура"]
        ],
        hint: "Дежнёв связан с крайней восточной частью Евразии, а Хабаров — с Амуром.",
        explanation: "Русские землепроходцы исследовали огромные пространства Сибири и Дальнего Востока."
      },

      {
        id: "geo-disc-12",
        type: "choice",
        title: "География сегодня",
        question: "После сильного наводнения нужно быстро определить, какие большие территории оказались затоплены. Какой источник информации особенно полезен?",
        options: [
          "Спутниковые снимки",
          "Старинная карта XV века",
          "Рассказ одного туриста",
          "Художественный роман"
        ],
        correct: 0,
        hint: "Нужна свежая информация сразу о большой территории.",
        explanation: "Спутники позволяют регулярно наблюдать большие участки поверхности Земли и быстро замечать изменения."
      },

      {
        id: "geo-disc-13",
        type: "text",
        title: "Источник географической информации",
        question: "Как называется собрание географических карт, объединённых в одну книгу или комплект?",
        answers: [
          "атлас",
          "географический атлас"
        ],
        hint: "Это слово часто встречается рядом со словом «карта».",
        explanation: "Собрание географических карт называют атласом."
      }
    ]
  },


  {
    id: "geo5-universe",
    number: "§8–11",
    title: "Земля во Вселенной",
    emoji: "☀️",
    short: "Солнечная система, движения Земли, гномон, времена года и солнечный свет.",
    facts: [
      "Место Земли во Вселенной и Солнечной системе.",
      "Осевое и орбитальное движение Земли.",
      "Солнцестояния, равноденствия и пояса освещённости."
    ],
    materials: [],
    tasks: [

      {
        id: "geo-space-1",
        type: "order",
        title: "Наш адрес во Вселенной",
        question: "Расположи объекты от меньшего к большему.",
        items: [
          "Земля",
          "Солнечная система",
          "Галактика Млечный Путь",
          "Вселенная"
        ],
        hint: "Земля вращается вокруг Солнца, а Солнечная система находится внутри нашей Галактики.",
        explanation: "Земля входит в Солнечную систему, Солнечная система — в Млечный Путь, а Галактика — часть Вселенной."
      },

      {
        id: "geo-space-2",
        type: "choice",
        title: "Солнце",
        question: "Что такое Солнце?",
        options: [
          "Планета",
          "Спутник",
          "Звезда",
          "Астероид"
        ],
        correct: 2,
        hint: "Солнце самостоятельно излучает свет и тепло.",
        explanation: "Солнце — звезда. Вокруг него обращаются Земля и другие планеты Солнечной системы."
      },

      {
        id: "geo-space-3",
        type: "choice",
        title: "Модель мира",
        question: "Какое утверждение соответствует гелиоцентрической системе Николая Коперника?",
        options: [
          "Солнце и планеты вращаются вокруг неподвижной Земли",
          "Земля и другие планеты обращаются вокруг Солнца",
          "Земля находится в центре всей Вселенной",
          "Луна является центром Солнечной системы"
        ],
        correct: 1,
        hint: "«Гелиос» означает Солнце.",
        explanation: "В гелиоцентрической системе центром движения планет является Солнце."
      },

      {
        id: "geo-space-4",
        type: "multi",
        title: "Солнечная система",
        question: "Выбери объекты, которые входят в Солнечную систему.",
        options: [
          "Солнце",
          "Планеты и их спутники",
          "Астероиды и кометы",
          "Вся галактика Млечный Путь"
        ],
        correct: [0, 1, 2],
        hint: "Солнечная система — только небольшая часть нашей Галактики.",
        explanation: "В Солнечную систему входят Солнце, планеты со спутниками и другие малые космические тела."
      },

      {
        id: "geo-space-5",
        type: "choice",
        title: "Форма Земли",
        question: "Какое описание формы Земли наиболее точное?",
        options: [
          "Идеально плоский круг",
          "Идеальный куб",
          "Шарообразное тело, немного сплюснутое у полюсов",
          "Идеальный цилиндр"
        ],
        correct: 2,
        hint: "В учебнике используется понятие «геоид».",
        explanation: "Земля имеет шарообразную форму и немного сплюснута у полюсов."
      },

      {
        id: "geo-space-6",
        type: "match",
        title: "Методы исследования",
        question: "Соедини метод изучения природы с его назначением.",
        pairs: [
          ["Наблюдение", "Позволяет следить за явлением и замечать его изменения"],
          ["Опыт", "Позволяет создать условия или модель для выяснения причин"],
          ["Измерение", "Даёт количественные характеристики объекта или явления"]
        ],
        hint: "Измерение связано с числами, а наблюдение не обязательно изменяет условия.",
        explanation: "Наблюдение, опыт и измерение дополняют друг друга при изучении природы."
      },

      {
        id: "geo-space-7",
        type: "text",
        title: "Наблюдение за Солнцем",
        question: "Как называется простейший прибор с вертикальным стержнем, по тени которого наблюдают изменение высоты Солнца?",
        answers: [
          "гномон"
        ],
        hint: "Слово начинается на букву «г».",
        explanation: "Гномон позволяет наблюдать за направлением и длиной тени в течение дня."
      },

      {
        id: "geo-space-8",
        type: "order",
        title: "Как меняется тень",
        question: "Расположи события по порядку в течение солнечного дня — от утра к вечеру.",
        items: [
          "Утром тень сравнительно длинная",
          "По мере подъёма Солнца тень становится короче",
          "Около полудня тень достигает минимальной длины",
          "После полудня тень снова удлиняется"
        ],
        hint: "Чем выше Солнце над горизонтом, тем короче тень.",
        explanation: "От восхода до полудня тень сокращается, а после полудня снова увеличивается."
      },

      {
        id: "geo-space-9",
        type: "match",
        title: "Два движения Земли",
        question: "Соедини движение Земли с его характеристикой.",
 pairs: [
  ["Осевое движение — период", "Примерно 24 часа"],
  ["Орбитальное движение — период", "Примерно 365 суток и 6 часов"],
  ["Осевое движение — следствие", "Смена дня и ночи"],
  ["Орбитальное движение — значение", "Связано с годовой сменой времён года"]
],
        hint: "Сутки связаны с осью, год — с орбитой.",
        explanation: "Осевое движение определяет суточный ритм, а орбитальное вместе с наклоном земной оси связано с сезонными изменениями."
      },

      {
        id: "geo-space-10",
        type: "choice",
        title: "Направление вращения",
        question: "В каком направлении Земля вращается вокруг своей оси?",
        options: [
          "С востока на запад",
          "С запада на восток",
          "С севера на юг",
          "Направление постоянно меняется"
        ],
        correct: 1,
        hint: "Из-за этого нам кажется, что Солнце движется по небу в противоположную сторону.",
        explanation: "Земля вращается вокруг своей оси с запада на восток."
      },

      {
        id: "geo-space-11",
        type: "multi",
        title: "Почему меняются времена года",
        question: "Выбери условия, которые вместе объясняют смену времён года.",
        options: [
          "Земля обращается вокруг Солнца",
          "Земная ось наклонена к плоскости орбиты",
          "Направление земной оси в пространстве сохраняется",
          "Каждую зиму Земля становится намного дальше от Солнца"
        ],
        correct: [0, 1, 2],
        hint: "Смена сезонов не объясняется просто расстоянием от Земли до Солнца.",
        explanation: "Сезоны возникают из-за орбитального движения Земли, наклона её оси и сохранения направления оси в пространстве."
      },

      {
        id: "geo-space-12",
        type: "choice",
        title: "Солнце в зените",
        question: "Что означает выражение «Солнце находится в зените»?",
        options: [
          "Солнце находится за горизонтом",
          "Солнечные лучи падают на поверхность отвесно",
          "Наступает полярная ночь",
          "Солнце находится дальше всего от Земли"
        ],
        correct: 1,
        hint: "Зенит — самое высокое положение Солнца над горизонтом.",
        explanation: "Когда Солнце находится в зените, солнечные лучи падают на земную поверхность отвесно."
      },

      {
        id: "geo-space-13",
        type: "match",
        title: "Особые линии Земли",
        question: "Соедини линию или область с её значением.",
        pairs: [
          ["Экватор", "Делит Землю на Северное и Южное полушария"],
          ["Тропики", "Ограничивают область, где Солнце может быть в зените"],
          ["Полярные круги", "Ограничивают области, где возможны полярный день и полярная ночь"]
        ],
        hint: "Одна линия делит Землю пополам, другие связаны с особенностями освещения.",
        explanation: "Экватор, тропики и полярные круги помогают объяснять распределение солнечного света по Земле."
      },

      {
        id: "geo-space-14",
        type: "choice",
        title: "Летнее солнцестояние",
        question: "Что происходит около 20–21 июня в Северном полушарии?",
        options: [
          "Самый короткий день и самая длинная ночь",
          "День и ночь имеют одинаковую продолжительность",
          "Самый длинный день и самая короткая ночь",
          "Во всём Северном полушарии наступает полярная ночь"
        ],
        correct: 2,
        hint: "Это день летнего солнцестояния.",
        explanation: "Около 20–21 июня Северное полушарие наиболее освещено: день самый длинный, а ночь самая короткая."
      },

      {
        id: "geo-space-15",
        type: "order",
        title: "Годовой круг",
        question: "Расположи события по порядку, начиная с весеннего равноденствия.",
        items: [
          "Весеннее равноденствие — март",
          "Летнее солнцестояние — июнь",
          "Осеннее равноденствие — сентябрь",
          "Зимнее солнцестояние — декабрь"
        ],
        hint: "Вспомни последовательность месяцев: март → июнь → сентябрь → декабрь.",
        explanation: "В течение года равноденствия приходятся на март и сентябрь, а солнцестояния — на июнь и декабрь."
      }
    ]
  }
];
let currentGrade = null;
let currentSubject = null;

function renderHome(){
  currentGrade = null;
  currentSubject = null;
  currentTopicId = null;

  app.innerHTML = `
    <section class="hero">
      <div class="hero-card">
        <div class="kicker">Академика • Учёба</div>
        <h1>Выбери свой класс</h1>
        <p class="lead">Здесь собраны уроки, презентации и задания по школьным предметам.</p>
      </div>
    </section>

    <div class="section-title">
      <div>
        <h2>Классы</h2>
        <p>Нажми на свой класс, чтобы выбрать предмет.</p>
      </div>
    </div>

    <section class="topic-grid">
      ${[1,2,3,4,5].map(grade => `
        <button class="topic-card grade-card" data-grade="${grade}">
          <div class="topic-num">${grade}</div>
          <div class="topic-emoji">🎒</div>
          <h3>${grade} класс</h3>
          <p>Перейти к предметам</p>
          <div class="topic-footer">
            <span></span>
            <span class="go">Открыть →</span>
          </div>
        </button>
      `).join('')}
    </section>
  `;

  $$('.grade-card').forEach(btn => {
    btn.onclick = () => renderSubjectSelect(btn.dataset.grade);
  });
}

function renderSubjectSelect(grade){
  currentGrade = grade;
  currentSubject = null;

  const subjects = GRADE_SUBJECTS[grade] || [];

  app.innerHTML = `
    <button class="back" id="backToGrades">← К классам</button>

    <div class="section-title">
      <div>
        <div class="kicker">Академика • Учёба</div>
        <h2>${grade} класс</h2>
        <p>Выбери предмет.</p>
      </div>
    </div>

    <section class="topic-grid">
      ${subjects.map(subject => `
        <button class="topic-card subject-card" data-subject="${subject.id}">
          <div class="topic-emoji">${subject.emoji}</div>
          <h3>${escapeHtml(subject.title)}</h3>
          <p>Уроки, презентации и задания</p>
          <div class="topic-footer">
            <span></span>
            <span class="go">Открыть →</span>
          </div>
        </button>
      `).join('')}
    </section>
  `;

  $('#backToGrades').onclick = renderHome;

  $$('.subject-card').forEach(btn => {
    btn.onclick = () => openSubject(grade, btn.dataset.subject);
  });
}

function openSubject(grade, subject){
  currentGrade = grade;
  currentSubject = subject;

  if(grade === '5' && subject === 'history'){
    renderCourseHome();
    return;
  }
if(grade === '5' && subject === 'geography'){
  renderGeographyHome();
  return;
}
  const info = (GRADE_SUBJECTS[grade] || []).find(s => s.id === subject);

  app.innerHTML = `
    <button class="back" id="backToSubjects">← К предметам</button>

    <section class="hero">
      <div class="hero-card">
        <div class="kicker">${grade} класс</div>
        <h1>${escapeHtml(info?.title || 'Предмет')}</h1>
        <p class="lead">Материалы для этого предмета скоро появятся.</p>
      </div>
    </section>
  `;

  $('#backToSubjects').onclick = () => renderSubjectSelect(grade);
}

  function renderGeographyHome(){
  currentGrade = '5';
  currentSubject = 'geography';
  currentTopicId = null;

  const completed = GEOGRAPHY_5_TOPICS.filter(
    t => (progress[t.id]?.percent || 0) >= 70
  ).length;

  const overall = Math.round(
    completed / GEOGRAPHY_5_TOPICS.length * 100
  );

  app.innerHTML = `
    <button class="back" id="backToSubjects">← 5 класс • Предметы</button>

    <section class="hero">
      <div class="hero-card">
        <div class="kicker">5 класс • География</div>
        <h1>География</h1>
        <p class="lead">
          Проверочные работы по изученным темам.
          Здесь важно не только помнить факты, но и понимать причины и связи.
        </p>

        <div class="student-banner">
          🌍 ${escapeHtml(student.name)}
        </div>
      </div>

      <div class="progress-card">
        <div>
          <div class="big-star">⭐</div>
          <div class="small">Прогресс по географии</div>
          <div class="progress-number">${overall}%</div>
        </div>

        <div>
          <div class="progress-bar">
            <div style="width:${overall}%"></div>
          </div>

          <p class="small">
            Пройдено ${completed} из ${GEOGRAPHY_5_TOPICS.length} проверочных
          </p>
        </div>
      </div>
    </section>

    <div class="section-title">
      <div>
        <h2>Проверочные работы</h2>
        <p>Выбери тему.</p>
      </div>
    </div>

    <section class="topic-grid">
      ${GEOGRAPHY_5_TOPICS.map(t => {
        const tp = progress[t.id]?.percent || 0;
        const st = starsFor(tp);

        return `
          <button class="topic-card geography-topic" data-topic="${t.id}">
            <div class="topic-num">${escapeHtml(t.number)}</div>
            <div class="topic-emoji">${t.emoji}</div>

            <h3>${escapeHtml(t.title)}</h3>

            <p>${escapeHtml(t.short)}</p>

            <div class="topic-footer">
              <span class="stars">${starsText(st)}</span>
              <span class="go">
                ${tp ? `${tp}% • Повторить →` : 'Начать →'}
              </span>
            </div>
          </button>
        `;
      }).join('')}
    </section>
  `;

  $('#backToSubjects').onclick = () => renderSubjectSelect('5');

  $$('.geography-topic').forEach(btn => {
    btn.onclick = () => openGeographyTopic(btn.dataset.topic);
  });
}


function openGeographyTopic(id){
  const topic = GEOGRAPHY_5_TOPICS.find(t => t.id === id);

  if(!topic) return;

  currentGrade = '5';
  currentSubject = 'geography';
  currentTopicId = id;

  ensureTaskState(topic);
  renderTopic(topic);
}
function renderCourseHome(){
  currentTopicId=null;
  const p=totalCourseProgress();
  app.innerHTML=`
<button class="back" id="backToSubjects">← 5 класс • Предметы</button>

<section class="hero">
      <div class="hero-card">
        <div class="kicker">${escapeHtml(content.courseTitle)}</div>
        <h1>Изучай историю шаг за шагом</h1>
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
  $('#backToSubjects').onclick=()=>renderSubjectSelect('5');
  $$('.topic-card').forEach(b=>b.onclick=()=>openTopic(b.dataset.topic));
}

function ensureTaskState(topic){
  if(taskState[topic.id]) return;
  taskState[topic.id]={index:0, solved:{}, attempts:{}, answers:{}, points:{}};
}

function openTopic(id){ currentTopicId=id; const t=content.topics.find(x=>x.id===id); if(!t)return; ensureTaskState(t); renderTopic(t); }
function materialCards(t){
  const mats=t.materials||[]; if(!mats.length)return '';
  return `<section class="study-first"><div class="study-first-head"><div><div class="kicker">Сначала повтори</div><h2>Материалы к теме</h2><p>Если что-то забылось — открой презентацию, а потом переходи к заданиям.</p></div><div class="study-icon">📖</div></div><div class="material-grid">${mats.map(m=>`<button class="material-card" data-mid="${escapeHtml(m.id)}"><span class="material-ico">${m.type==='presentation'?'🖥️':'📎'}</span><span><b>${escapeHtml(m.title||'Материал')}</b><small>${m.source==='file'?'Открыть презентацию':'Открыть по ссылке'}</small></span><span class="go">Открыть →</span></button>`).join('')}</div></section>`;
}
function openMaterial(t,mid){
  const m=(t.materials||[]).find(x=>x.id===mid); if(!m)return;
  const safeUrl=escapeHtml(m.url||'');
  openModal(`<div class="presentation-modal-head"><div><div class="kicker">Материал к теме</div><h2>${escapeHtml(m.title||'Презентация')}</h2></div><button class="btn ghost" onclick="closeModal()">Закрыть</button></div><div class="presentation-viewer"><iframe src="${safeUrl}" title="${escapeHtml(m.title||'Презентация')}" loading="lazy"></iframe></div><div class="controls"><a class="btn ghost link-btn" href="${safeUrl}" target="_blank" rel="noopener">Открыть в новой вкладке</a><button class="btn primary" onclick="closeModal()">Я повторил(а) тему → к заданиям</button></div><p class="small">Если встроенный просмотр не появился, используйте кнопку «Открыть в новой вкладке».</p>`);
}
function returnToCurrentSubject(){
  if(currentGrade === '5' && currentSubject === 'geography'){
    renderGeographyHome();
    return;
  }

  if(currentGrade === '5' && currentSubject === 'history'){
    renderCourseHome();
    return;
  }

  renderSubjectSelect(currentGrade || '5');
}
function renderTopic(t){
  const state=taskState[t.id];
  const idx=Math.max(0,Math.min(state.index,Math.max(0,t.tasks.length-1))); state.index=idx;
  const completed=Object.keys(state.solved).length===t.tasks.length && t.tasks.length>0;
  app.innerHTML=`
    <button class="back" id="backHome">← К темам</button>
    <div class="lesson-head"><div><div class="kicker">${escapeHtml(t.number)}</div><h1>${escapeHtml(t.title)}</h1><p class="lead">${escapeHtml(t.short||'')}</p></div><div class="lesson-badge">${t.emoji||'📚'}</div></div>
    <div class="fact-strip">${(t.facts||[]).map(f=>`<div class="fact">${escapeHtml(f)}</div>`).join('')}</div>
    ${materialCards(t)}
    ${completed ? completionHtml(t,state) : (t.tasks.length?`<div class="task-wrap"><nav class="task-nav">${t.tasks.map((q,i)=>`<button data-idx="${i}" class="${i===idx?'active':''} ${state.solved[q.id]?'done':''}">${i+1}. ${escapeHtml(q.title||'Задание')}</button>`).join('')}</nav><section id="taskArea"></section></div>`:`<div class="admin-card"><b>Заданий пока нет.</b> Сначала изучи материал выше.</div>`)}
  `;
$('#backHome').onclick=returnToCurrentSubject;
  $$('.material-card').forEach(b=>b.onclick=()=>openMaterial(t,b.dataset.mid));
  if(completed){ $('#againBtn').onclick=()=>{taskState[t.id]={index:0,solved:{},attempts:{},answers:{},points:{}};renderTopic(t)}; return; }
  if(!t.tasks.length)return;
  $$('.task-nav button').forEach(b=>b.onclick=()=>{state.index=+b.dataset.idx;renderTopic(t)});
  renderTask(t,t.tasks[idx],state);
}

function completionHtml(t,state){
  const solved=Object.values(state.solved).filter(Boolean).length;
  const earned=Object.values(state.points||{}).reduce((a,b)=>a+b,0);
  const percent=Math.round(earned/t.tasks.length*100); const stars=starsFor(percent);
  saveProgress(t.id,percent,stars,Object.values(state.attempts).reduce((a,b)=>a+b,0));
  setTimeout(confetti,80);
  return `<div class="completion"><div class="trophy">${percent>=90?'🏆':'🌟'}</div><h2>Урок пройден!</h2><div class="stars" style="font-size:32px">${starsText(stars)}</div><p class="score">${solved} из ${t.tasks.length} заданий • ${percent}%</p><p>${percent>=90?'Отличная работа!':percent>=70?'Тема освоена. Можно двигаться дальше!':'Можно пройти ещё раз и улучшить результат.'}</p><div class="controls" style="justify-content:center"><button class="btn yellow" id="againBtn">Пройти ещё раз</button><button class="btn primary" onclick="returnToCurrentSubject()"К темам</button></div></div>`;
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
    openModal(`<h2>Режим учителя</h2><p>Введите PIN учителя.</p><div class="field"><input id="pinInput" type="password" placeholder="PIN"></div><div class="controls"><button class="btn primary" id="pinGo">Войти</button><button class="btn ghost" onclick="closeModal()">Отмена</button></div>`);
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
let adminSubject = 'history';

function geographyTopics(){
  if(!Array.isArray(content.geographyTopics)){
    content.geographyTopics = clone(GEOGRAPHY_5_TOPICS);
  }
  return content.geographyTopics;
}

function activeAdminTopics(){
  return adminSubject === 'geography'
    ? geographyTopics()
    : (content.topics || []);
}

function setActiveAdminTopics(topics){
  if(adminSubject === 'geography'){
    content.geographyTopics = topics;
  }else{
    content.topics = topics;
  }
}

function findTopicAny(topicId){
  return (content.topics || []).find(t => t.id === topicId)
    || geographyTopics().find(t => t.id === topicId);
}
function renderAdminContent(){
  const m = $('#adminMain');
  const topics = activeAdminTopics();

  m.innerHTML = `
    <div class="admin-card">
      <div class="spread">
        <div>
          <h2>${adminSubject === 'geography' ? 'География • 5 класс' : 'История • 5 класс'}</h2>
          <p class="small">
            Можно менять темы, добавлять презентации и редактировать задания.
          </p>
        </div>

        <button class="btn yellow" id="addTopic">+ Новая тема</button>
      </div>

      <div class="controls" style="margin-top:18px">
        <button
          class="btn ${adminSubject === 'history' ? 'primary' : 'ghost'}"
          data-admin-subject="history">
          🏺 История
        </button>

        <button
          class="btn ${adminSubject === 'geography' ? 'primary' : 'ghost'}"
          data-admin-subject="geography">
          🌍 География
        </button>
      </div>
    </div>

    ${topics.map(t => `
      <div class="admin-card" style="margin-top:18px">

        <div class="spread">
          <div>
            <div class="kicker">${escapeHtml(t.number || '')}</div>
            <h2>${t.emoji || '📚'} ${escapeHtml(t.title || '')}</h2>
            <p>${escapeHtml(t.short || '')}</p>
          </div>

          <div class="controls">
            <button class="btn ghost edit-topic" data-id="${t.id}">
              Изменить тему
            </button>

            <button class="btn danger delete-topic" data-id="${t.id}">
              Удалить
            </button>
          </div>
        </div>

        <div class="material-admin" style="margin-top:22px">
          <div class="spread">
            <div>
              <h3>Материалы (${(t.materials || []).length})</h3>
              <p class="small">
                PDF и PPTX открываются ребёнку прямо в теме.
                Можно также добавить внешнюю ссылку.
              </p>
            </div>

            <button class="btn yellow add-material" data-t="${t.id}">
              + Презентация
            </button>
          </div>

          ${(t.materials || []).map(mat => `
            <div class="spread" style="margin-top:12px">
              <div>
                🖥️
                <b>${escapeHtml(mat.title || 'Презентация')}</b>
                <div class="small">
                  ${escapeHtml(mat.sourceName || mat.url || '')}
                </div>
              </div>

              <div class="controls">
                <button
                  class="btn ghost open-admin-material"
                  data-t="${t.id}"
                  data-m="${mat.id}">
                  Открыть
                </button>

                <button
                  class="btn ghost rename-material"
                  data-t="${t.id}"
                  data-m="${mat.id}">
                  Название
                </button>

                <button
                  class="btn danger delete-material"
                  data-t="${t.id}"
                  data-m="${mat.id}">
                  ×
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <h3 style="margin-top:24px">
          Задания (${(t.tasks || []).length})
        </h3>

        ${(t.tasks || []).map((q,i) => `
          <div class="task-edit-item spread">
            <div>
              <b>${i + 1}. ${escapeHtml(q.title || q.question || 'Задание')}</b>
              <div class="small">
                Тип: ${escapeHtml(typeName(q.type))}
              </div>
            </div>

            <div class="controls">
              <button
                class="btn ghost move-up"
                data-t="${t.id}"
                data-i="${i}">
                ↑
              </button>

              <button
                class="btn ghost move-down"
                data-t="${t.id}"
                data-i="${i}">
                ↓
              </button>

              <button
                class="btn ghost edit-task"
                data-t="${t.id}"
                data-q="${q.id}">
                Изменить
              </button>

              <button
                class="btn danger delete-task"
                data-t="${t.id}"
                data-q="${q.id}">
                ×
              </button>
            </div>
          </div>
        `).join('')}

        <button
          class="btn yellow add-task"
          data-t="${t.id}"
          style="margin-top:14px">
          + Задание
        </button>
      </div>
    `).join('')}
  `;

  $$('[data-admin-subject]').forEach(b => {
    b.onclick = () => {
      adminSubject = b.dataset.adminSubject;
      renderAdminContent();
    };
  });

  $('#addTopic').onclick = () => editTopic(null);

  $$('.edit-topic').forEach(b => {
    b.onclick = () => editTopic(findTopicAny(b.dataset.id));
  });

  $$('.delete-topic').forEach(b => {
    b.onclick = async () => {
      if(!confirm('Удалить тему вместе с заданиями?')) return;

      setActiveAdminTopics(
        activeAdminTopics().filter(t => t.id !== b.dataset.id)
      );

      await persistContent();
      renderAdminContent();
    };
  });

  $$('.add-material').forEach(b => {
    b.onclick = () => addMaterial(b.dataset.t);
  });

  $$('.open-admin-material').forEach(b => {
    b.onclick = () => {
      const t = findTopicAny(b.dataset.t);
      if(t) openMaterial(t, b.dataset.m);
    };
  });

  $$('.rename-material').forEach(b => {
    b.onclick = () => renameMaterial(b.dataset.t, b.dataset.m);
  });

  $$('.delete-material').forEach(b => {
    b.onclick = () => deleteMaterial(b.dataset.t, b.dataset.m);
  });

  $$('.add-task').forEach(b => {
    b.onclick = () => editTask(b.dataset.t, null);
  });

  $$('.edit-task').forEach(b => {
    b.onclick = () => {
      const t = findTopicAny(b.dataset.t);
      const q = (t?.tasks || []).find(q => q.id === b.dataset.q);
      editTask(b.dataset.t, q);
    };
  });

  $$('.delete-task').forEach(b => {
    b.onclick = async () => {
      if(!confirm('Удалить задание?')) return;

      const t = findTopicAny(b.dataset.t);
      if(!t) return;

      t.tasks = (t.tasks || []).filter(q => q.id !== b.dataset.q);

      await persistContent();
      renderAdminContent();
    };
  });

  $$('.move-up').forEach(b => {
    b.onclick = () => moveTask(b.dataset.t, +b.dataset.i, -1);
  });

  $$('.move-down').forEach(b => {
    b.onclick = () => moveTask(b.dataset.t, +b.dataset.i, 1);
  });
}
async function uploadPresentation(topicId,title,file){
  if(mode!=='server')throw new Error('Загрузка файлов работает после публикации сайта на Railway.');
  const form=new FormData();form.append('topicId',topicId);form.append('title',title);form.append('file',file);
  const res=await fetch('/api/presentations',{method:'POST',headers:{'X-Teacher-Pin':teacherPin},body:form});
  const data=await res.json().catch(()=>({error:'Ошибка загрузки'})); if(!res.ok)throw new Error(data.error||'Ошибка загрузки'); return data;
}
function addMaterial(topicId){
  openModal(`<h2>Добавить презентацию</h2><p>Выберите способ. Для обычной презентации удобнее загрузить PPTX или PDF.</p><div class="form-grid"><div class="field"><label>Название для ребёнка</label><input id="matTitle" value="Повтори тему по презентации"></div><div class="material-choice"><button class="choice-tile active" id="fileMode">📤 Загрузить PDF / PPTX</button><button class="choice-tile" id="linkMode">🔗 Добавить ссылку</button></div><div id="matFields"></div></div><div class="controls"><button class="btn primary" id="saveMaterial">Добавить</button><button class="btn ghost" onclick="closeModal()">Отмена</button></div><div id="uploadStatus"></div>`);
  let kind='file';
  const fields=$('#matFields');
  const redraw=()=>{
    $('#fileMode').classList.toggle('active',kind==='file');$('#linkMode').classList.toggle('active',kind==='link');
    fields.innerHTML=kind==='file'?`<div class="field"><label>Файл</label><input id="matFile" type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"><div class="help">До 40 МБ. PPTX сайт автоматически преобразует в PDF. PDF загружается быстрее.</div></div>`:`<div class="field"><label>Ссылка</label><input id="matUrl" type="url" placeholder="https://..."><div class="help">Подойдёт публичная ссылка на Google Slides, Canva, PDF и другие материалы. Некоторые сайты запрещают встроенный просмотр — тогда ребёнок откроет материал в новой вкладке.</div></div>`;
  }; redraw();
  $('#fileMode').onclick=()=>{kind='file';redraw()};$('#linkMode').onclick=()=>{kind='link';redraw()};
  $('#saveMaterial').onclick=async()=>{
    const title=$('#matTitle').value.trim()||'Презентация';const status=$('#uploadStatus');const btn=$('#saveMaterial');
    try{btn.disabled=true;status.innerHTML='<div class="feedback hint">Загружаю… Не закрывайте окно.</div>';
      if(kind==='file'){const f=$('#matFile').files[0];if(!f)throw new Error('Выберите файл');const r=await uploadPresentation(topicId,title,f);content=r.content;adminData.content=content;}
      else{const url=$('#matUrl').value.trim();if(!/^https?:\/\//i.test(url))throw new Error('Введите полную ссылку, начиная с https://');const t=findTopicAny(topicId);t.materials=t.materials||[];t.materials.push({id:uid(),type:'presentation',title,source:'link',url});await persistContent();}
      closeModal();renderAdmin('content');
    }catch(e){status.innerHTML=`<div class="feedback bad">${escapeHtml(e.message)}</div>`;btn.disabled=false;}
  };
}
async function renameMaterial(topicId,mid){
 const t=findTopicAny(topicId),mat=(t.materials||[]).find(x=>x.id===mid);if(!mat)return;
  openModal(`<h2>Название материала</h2><div class="field"><label>Что увидит ребёнок</label><input id="renameMat" value="${escapeHtml(mat.title||'Презентация')}"></div><div class="controls"><button class="btn primary" id="renameMatSave">Сохранить</button><button class="btn ghost" onclick="closeModal()">Отмена</button></div>`);
  $('#renameMatSave').onclick=async()=>{mat.title=$('#renameMat').value.trim()||'Презентация';await persistContent();closeModal();renderAdmin('content')};
}
async function deleteMaterial(topicId,mid){
  if(!confirm('Удалить эту презентацию из темы?'))return;
const t=findTopicAny(topicId),mat=(t.materials||[]).find(x=>x.id===mid);if(!mat)return;
  if(mode==='server'&&mat.source==='file'){const r=await api('/api/presentations/'+encodeURIComponent(mid),{method:'DELETE'});content=r.content;adminData.content=content;}
  else{t.materials=(t.materials||[]).filter(x=>x.id!==mid);await persistContent();}
  renderAdmin('content');
}
function typeName(t){return ({choice:'один ответ',multi:'несколько ответов',text:'ввод текста',order:'порядок',match:'пары',sort:'сортировка',canvas:'рисование'})[t]||t}
async function moveTask(tid,i,d){
  const t=findTopicAny(tid);

  if(!t) return;

  const j=i+d;

  if(j<0 || j>=t.tasks.length) return;

  [t.tasks[i],t.tasks[j]]=[t.tasks[j],t.tasks[i]];

  await persistContent();
  renderAdminContent();
}
function editTopic(t){
  const x=t || {
    id:uid(),
    number:'§ ',
    title:'Новая тема',
    emoji:'📚',
    short:'',
    facts:['','',''],
    materials:[],
    tasks:[]
  };

  openModal(`
    <h2>${t ? 'Изменить тему' : 'Новая тема'}</h2>

    <div class="form-grid">

      <div class="field">
        <label>Номер</label>
        <input id="etNum" value="${escapeHtml(x.number || '')}">
      </div>

      <div class="field">
        <label>Название</label>
        <input id="etTitle" value="${escapeHtml(x.title || '')}">
      </div>

      <div class="field">
        <label>Эмодзи</label>
        <input id="etEmoji" value="${escapeHtml(x.emoji || '📚')}">
      </div>

      <div class="field">
        <label>Короткое описание</label>
        <textarea id="etShort">${escapeHtml(x.short || '')}</textarea>
      </div>

      <div class="field">
        <label>3 главных факта</label>
        <textarea id="etFacts">${escapeHtml((x.facts || []).join('\n'))}</textarea>
        <div class="help">Каждый факт с новой строки.</div>
      </div>

    </div>

    <div class="controls">
      <button class="btn primary" id="saveTopic">Сохранить</button>
      <button class="btn ghost" onclick="closeModal()">Отмена</button>
    </div>
  `);

  $('#saveTopic').onclick=async()=>{
    x.number=$('#etNum').value;
    x.title=$('#etTitle').value;
    x.emoji=$('#etEmoji').value;
    x.short=$('#etShort').value;

    x.facts=$('#etFacts').value
      .split('\n')
      .map(s=>s.trim())
      .filter(Boolean);

    if(!t){
      activeAdminTopics().push(x);
    }

    await persistContent();
    closeModal();
    renderAdminContent();
  };
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
   const t=findTopicAny(topicId); if(q){const i=t.tasks.findIndex(a=>a.id===q.id);t.tasks[i]=x}else t.tasks.push(x); await persistContent();closeModal();renderAdmin('content');
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
 const m=$('#adminMain');

const allResultTopics = [
  ...(content.topics || []),
...geographyTopics()
];

const topicMap = Object.fromEntries(
  allResultTopics.map(t => [t.id, `${t.number} ${t.title}`])
);
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
