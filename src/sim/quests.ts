// ============================================================================
// Ситуаційні виклики (квести). В описі — лише об'єктивні симптоми.
// Еталонне рішення приховане й відкривається лише викладачем.
// ============================================================================
import { EPSH_WEEDS, TILLAGE, gddForBbch } from './data';
import { liveCrop } from './diagnostics';
import { addLog, createInitialState, cropAtBbch, questFailed, questSolved } from './engine';
import { initPhysiology, refreshFactors } from './physiology';
import { layer, panBlocking } from './soil';
import type { QuestId, SimState, ZoneId } from './types';
import { generateWeather } from './weather';

export interface QuestDef {
  id: QuestId;
  title: string;
  zone: ZoneId;
  day: number; // абсолютний день (2026 р.)
  level: 1 | 2 | 3;
  symptoms: string[];
  solution: string[];
}

export const QUEST_ORDER: QuestId[] = ['crust', 'frost', 'pan', 'septoria', 'nitrogen', 'wetsoil', 'coldsoil', 'acid', 'weeds', 'beetle', 'mites', 'lodging'];

export const QUESTS: Record<QuestId, QuestDef> = {
  crust: {
    id: 'crust', level: 2, zone: 'lisostep', day: 128,
    title: 'Повітряна посуха та ґрунтова кірка після зливи',
    symptoms: [
      'Соняшник висіяно 8 діб тому, сівалка налаштована на 5 см.',
      '4 доби тому — злива 41 мм за 40 хвилин; після неї спека до +31 °C, відносна вологість повітря 24–30%.',
      'Сходів у рядках немає. Поверхня поля сіра, глянцева, з полігональними тріщинами.',
    ],
    solution: ['Лопатка + лінійка: проростки живі, «штопорять» під кіркою 2 см.', 'Ротаційна борона (2–3 см) — руйнує кірку, не зачіпаючи насіння на 5 см.', 'Помилки: оранка/диски/культиватор/зубова борона/коток, списання посіву.'],
  },
  frost: {
    id: 'frost', level: 2, zone: 'lisostep', day: 136,
    title: 'Нічний приморозок −2 °C по сходах кукурудзи',
    symptoms: [
      'Минулої ночі температура повітря на висоті 2 м опустилась до −2 °C, на траві — іній.',
      'Кукурудза у фазі 3 листків. Листкові пластинки почорніли, водянисті, частина листків полягла.',
      'Температура ґрунту на глибині 5 см о 6:00 — +1,8 °C.',
    ],
    solution: ['Лопатка (розріз точки росту) або ґрунтові термометри: на 2,5 см ґрунт > 0 °C, конус наростання живий.', 'Антистресант (амінокислоти + гумати), без пересіву.', 'Помилки: списання/пересів, дискування, страховий гербіцид по стресованих рослинах.'],
  },
  pan: {
    id: 'pan', level: 3, zone: 'lisostep', day: 188,
    title: 'В\'янення рослин за наявності вологи в глибоких шарах',
    symptoms: [
      'Кукурудза, фаза стеблування. Шосту добу поспіль з 12:00 до 17:00 листя скручується «в трубку», рослини втрачають тургор; уночі частково відновлюються.',
      'За травень–червень випало 64 мм опадів, останні 11 діб опадів не було.',
      'Висота рослин нерівномірна, нижнє листя з ознаками передчасного старіння. Багаторічна оранка на 25–27 см.',
    ],
    solution: ['Пенетрометр: 3,6 МПа на 30–35 см; бур: A — 26% НВ, B — 84% НВ.', 'Глибоке розпушування чизелем (40–42 см) по міжряддях.', 'Помилки: оранка, диски, культиватор, плоскоріз, strip-till — не дістають до 30–35 см.'],
  },
  septoria: {
    id: 'septoria', level: 2, zone: 'lisostep', day: 142,
    title: 'Спалах септоріозу пшениці при шквальному вітрі 9,5 м/с',
    symptoms: [
      'Пшениця озима, прапорцевий листок повністю розгорнутий.',
      'На листках нижнього та середнього ярусів — видовжені світло-бурі некротичні плями, обмежені жилками; площа ураження ~44%.',
      'Метеостанція: вітер поривами 9,5 м/с, відносна вологість 78%, температура +16 °C; прогноз — затухання вітру після заходу сонця.',
    ],
    solution: ['Лупа ×20: пікніди в плямах; агрометеостанція: тривале зволоження листка.', 'Перемкнути обприскувач на вечірню зміну + інжекторні розпилювачі (вітер 2,1 м/с).', 'Фунгіцид (триазоли + стробілурини). Помилки: обробка вдень при 9,5 м/с, інсектицид.'],
  },
  nitrogen: {
    id: 'nitrogen', level: 1, zone: 'polissia', day: 98,
    title: 'Пожовтіння пшениці після теплої дощової зими',
    symptoms: [
      'Пшениця озима у фазі кущіння, відновлення весняної вегетації.',
      'Зима тепла, опадів за листопад–березень — 160% норми. Ґрунт супіщаний.',
      'Посів рівномірно світло-зелений, жовтуватий; нижні листки жовтіють від верхівки. Плям, нальоту та комах не виявлено.',
    ],
    solution: ['N-тестер (низький SPAD) або бур/агрохіманаліз: у шарі 0–30 см N < 5 мг/кг, нітрати вимиті в горизонт B.', 'Ранньовесняне підживлення КАС-32 / карбамідом.'],
  },
  wetsoil: {
    id: 'wetsoil', level: 1, zone: 'lisostep', day: 100,
    title: 'Перезволожене поле: чи виходити з технікою?',
    symptoms: [
      'Сніг зійшов 6 діб тому, за минулий тиждень — 14 мм дощу.',
      'Поверхня глянцева, у пониженнях — калюжі; ґрунт налипає на чоботи та колеса.',
      'За планом — передпосівна культивація та посів. Механізатори чекають команди.',
    ],
    solution: ['Бур + вологомір: вологість горизонту A > 80% НВ — ґрунт у пластичному стані.', 'Чекати фізичної стиглості (A ≤ 80% НВ), за потреби — лише легке боронування.', 'Потім культивація/посів. Помилка: будь-яка важка техніка при > 80% НВ.'],
  },
  coldsoil: {
    id: 'coldsoil', level: 1, zone: 'lisostep', day: 103,
    title: 'Холодна весна: коли сіяти кукурудзу?',
    symptoms: [
      'Поле підготовлене під посів кукурудзи, культивацію проведено.',
      'Удень повітря прогрівається до +16…+18 °C, ночі холодні (+1…+4 °C).',
      'Сусідні господарства вже розпочали сівбу.',
    ],
    solution: ['Ґрунтові термометри: на глибині 5–10 см уранці < +10 °C.', 'Дочекатися стійкого прогрівання ґрунту до +10…+12 °C (дні «+1»), потім сіяти кукурудзу на 4–6 см.', 'Помилка: посів у холодний ґрунт.'],
  },
  acid: {
    id: 'acid', level: 3, zone: 'polissia', day: 95,
    title: 'Планування сої на кислому ґрунті',
    symptoms: [
      'Господарство планує посів сої після зернових.',
      'Торік на цьому полі соя мала дрібні білі бульбочки, рослини були світліші за норму, урожай — 1,4 т/га.',
      'Ґрунт дерново-підзолистий; подекуди ростуть щавель малий та хвощ польовий.',
    ],
    solution: ['Агрохімічний аналіз (або бур): pH(KCl) 5,0 — сильнокислий.', 'Вапнування (CaCO₃ 4 т/га), далі дочекатися ґрунту ≥ +10 °C.', 'Посів сої з інокуляцією. Помилки: посів без вапнування, посів у холодний ґрунт.'],
  },
  weeds: {
    id: 'weeds', level: 1, zone: 'lisostep', day: 152,
    title: 'Масові сходи бур\'янів у кукурудзі',
    symptoms: [
      'Кукурудза у фазі 4 листків, рослини без ознак стресу.',
      'У рядках та міжряддях — масові сходи лободи, щириці, плоскухи у фазі 2–4 листків.',
      'Ґрунтовий гербіцид не вносили через суху весну.',
    ],
    solution: ['Рамка 1 м²: ~48 шт./м² при ЕПШ 12 шт./м².', 'Страховий післясходовий гербіцид (BBCH 13–16) або міжрядна культивація.', 'Помилки: досходовий гербіцид по сходах, гліфосат, суцільна культивація/дискування.'],
  },
  beetle: {
    id: 'beetle', level: 2, zone: 'lisostep', day: 112,
    title: 'Пошкоджені бутони ріпаку перед цвітінням',
    symptoms: [
      'Ріпак озимий у фазі відокремлених бутонів, цвітіння ще не почалось.',
      'Удень +16…+18 °C, сонячно. Частина бутонів вигризена, суцвіття мають «голі» ніжки.',
      'Поруч розміщена пасіка (40 вуликів).',
    ],
    solution: ['Жовті пастки або лупа: 5–6 ріпакових квіткоїдів на рослину при ЕПШ 3.', 'Інсектицид до початку цвітіння, краще у вечірню зміну.', 'Помилки: інсектицид удень у цвітіння (бджоли), фунгіцид/акарицид.'],
  },
  mites: {
    id: 'mites', level: 3, zone: 'step', day: 205,
    title: 'Мармурове листя сої в спеку',
    symptoms: [
      'Соя у фазі початку цвітіння. Третій тиждень спека +32…+35 °C без опадів.',
      'На листках — дрібна світла крапчастість («мармуровість»), частина листків буріє й засихає.',
      'З нижнього боку листка — ледь помітна павутинка. Осередки з країв поля, біля лісосмуги.',
    ],
    solution: ['Лупа ×20: павутинний кліщ, 20+ ос./листок.', 'Акарицид (не інсектицид!), бажано ввечері.', 'Помилка: інсектицид-піретроїд — резургенція кліща.'],
  },
  lodging: {
    id: 'lodging', level: 2, zone: 'lisostep', day: 118,
    title: 'Загущена пшениця з надлишком азоту',
    symptoms: [
      'Пшениця озима, початок виходу в трубку (перше міжвузля).',
      'Восени висіяно 6,5 млн схожих насінин/га, навесні внесено N₉₀ по мерзлоталому ґрунту.',
      'Рослини темно-зелені, високі, стебла тонкі. Торік на сусідньому полі посіви полягли після червневих злив.',
    ],
    solution: ['Рамка: ~600 стебел/м² (норма 450); N-тестер: надлишок N.', 'Ретардант (хлормекват-хлорид + тринексапак-етил) у BBCH 30–32.', 'Помилки: додаткове N-підживлення, ретардант після BBCH 37.'],
  },
};

export function loadQuest(id: QuestId): SimState {
  const q = QUESTS[id];
  const s = createInitialState(q.zone, q.day);
  s.log = [];
  const a = layer(s, 'arable');
  const sb = layer(s, 'seedbed');
  const surf = layer(s, 'surface');
  const pan = layer(s, 'pan');
  const b = layer(s, 'transition');
  const c = layer(s, 'parent');
  s.snow = 0;

  switch (id) {
    case 'crust': {
      s.climate = 'drought';
      s.climateUntil = q.day + 5;
      s.residue = 4;
      s.crust = 2.0;
      s.weeds = 3;
      surf.moisture = 20; surf.density = 1.45;
      sb.moisture = 52; a.moisture = 66;
      const crop = cropAtBbch('sunflower', 7, q.day - 8, 5);
      crop.gdd = gddForBbch('sunflower', 10) - 15;
      crop.bbch = 9;
      crop.germPotential = 88;
      crop.crustDays = 2;
      crop.corkscrew = true;
      s.crop = crop;
      break;
    }
    case 'frost': {
      s.residue = 25;
      sb.moisture = 70; a.moisture = 74;
      surf.temp = 3; sb.temp = 4.6; a.temp = 6;
      const crop = cropAtBbch('corn', 13, 112, 5, 90);
      crop.leafFrost = 0.8;
      crop.stressUntil = q.day + 8;
      crop.stressCause = 'приморозок';
      crop.health = 55;
      crop.losses.frostLeaf = 0.97;
      s.crop = crop;
      s.weeds = 5;
      s.preHerbUntil = q.day + 20;
      break;
    }
    case 'pan': {
      s.residue = 10;
      surf.moisture = 16; sb.moisture = 22; a.moisture = 26;
      pan.resistance = 3.6; pan.density = 1.56; pan.moisture = 75;
      b.moisture = 84; c.moisture = 86;
      const crop = cropAtBbch('corn', 32, 118, 5, 88);
      crop.wilting = true;
      crop.waterSupply = 0.1;
      crop.waterIndex = 0.86;
      crop.health = 70;
      s.crop = crop;
      s.weeds = 4;
      break;
    }
    case 'septoria': {
      s.climate = 'wind';
      s.climateUntil = q.day + 2;
      s.residue = 30;
      sb.moisture = 66; a.moisture = 72;
      const crop = cropAtBbch('wheat', 39, 262 - 365, 4, 90);
      crop.disease = 44;
      crop.health = 72;
      crop.pests = 0.8;
      s.crop = crop;
      s.weeds = 4;
      break;
    }
    case 'nitrogen': {
      for (const l of [surf, sb, a]) l.nitrogen = 2.8;
      pan.nitrogen = 2;
      b.nitrate = 26; c.nitrate = 9;
      a.moisture = 78; sb.moisture = 76;
      const crop = cropAtBbch('wheat', 25, 265 - 365, 4, 88);
      crop.nStatus = 0.3; crop.nIndex = 0.9; crop.health = 74;
      s.crop = crop;
      s.weeds = 3;
      break;
    }
    case 'wetsoil': {
      surf.moisture = 96; sb.moisture = 92; a.moisture = 87; pan.moisture = 92; b.moisture = 90;
      s.residue = 40;
      s.weeds = 3;
      break;
    }
    case 'coldsoil': {
      s.seedbedQuality = 0.92;
      s.residue = 20;
      s.weeds = 1;
      sb.moisture = 70; a.moisture = 74;
      for (const l of s.layers.slice(0, 4)) l.temp = 6.5;
      break;
    }
    case 'acid': {
      for (const l of [surf, sb, a]) l.pH = 5.0;
      pan.pH = 5.1; b.pH = 5.3;
      s.nutrients = { ...s.nutrients, P2O5: 48, K2O: 52 };
      s.weeds = 4;
      break;
    }
    case 'weeds': {
      const crop = cropAtBbch('corn', 14, 118, 5, 92);
      s.crop = crop;
      s.weeds = 48;
      sb.moisture = 62; a.moisture = 68;
      break;
    }
    case 'beetle': {
      const crop = cropAtBbch('rapeseed', 55, 235 - 365, 2, 90);
      crop.pests = 5.6;
      s.crop = crop;
      s.weeds = 3;
      break;
    }
    case 'mites': {
      s.climate = 'heat';
      s.climateUntil = q.day + 6;
      surf.moisture = 14; sb.moisture = 24; a.moisture = 38; b.moisture = 55;
      const crop = cropAtBbch('soy', 61, 128, 4, 90);
      crop.pests = 22;
      crop.nodules = 18;
      crop.health = 70;
      s.crop = crop;
      s.weeds = 4;
      break;
    }
    case 'lodging': {
      a.nitrogen = 34; sb.nitrogen = 30;
      const crop = cropAtBbch('wheat', 31, 258 - 365, 4, 132);
      crop.nStatus = 1.4; crop.nIndex = 1;
      s.crop = crop;
      s.weeds = 3;
      break;
    }
  }
  if (s.crop && s.crop.emerged && panBlocking(s) && s.crop.rootDepth > 30) {
    s.crop.rootDepth = 30;
    s.crop.rootBlocked = true;
  }
  if (s.crop) {
    // передісторія стресу до моменту виклику
    const c = s.crop;
    if (id === 'pan') { c.vigor = 0.8; c.gRecent = 0.3; c.perfLoss = [0.16, 0, 0]; c.ledger = { water: [0.16, 0, 0] }; }
    if (id === 'septoria') { c.vigor = 0.92; c.gRecent = 0.7; c.perfLoss = [0.03, 0.12, 0]; c.ledger = { disease: [0.03, 0.12, 0] }; }
    if (id === 'mites') { c.vigor = 0.85; c.gRecent = 0.5; c.perfLoss = [0.1, 0.05, 0]; c.ledger = { water: [0.07, 0.01, 0], pests: [0.03, 0.04, 0] }; }
    if (id === 'nitrogen') { c.vigor = 0.8; c.gRecent = 0.45; c.perfLoss = [0.08, 0, 0]; c.ledger = { nitrogen: [0.08, 0, 0] }; }
    if (id === 'weeds') { c.gRecent = 0.75; c.perfLoss = [0.03, 0, 0]; c.ledger = { weeds: [0.03, 0, 0] }; }
    if (id === 'frost') { c.gRecent = 0.5; }
    c.vigorW = 0.1;
    initPhysiology(c);
  }
  s.weather = generateWeather(s.zone, s.day, s.climate, s.crop?.depth ?? 5);
  if (id === 'frost') s.weather = { ...s.weather, tMin: -2, tAir: 6.5, tMax: 12, tSoil: 1.8, wind: 1.1, rain: 0, humidity: 86, event: 'frost' };
  if (id === 'pan') s.weather = { ...s.weather, tAir: 26, tMax: 31, rain: 0, humidity: 42 };
  if (id === 'coldsoil') s.weather = { ...s.weather, tAir: 8.4, tMin: 1.6, tMax: 17, tSoil: 7.4, rain: 0 };
  if (id === 'wetsoil') s.weather = { ...s.weather, rain: 0, tAir: 9 };
  if (s.crop) refreshFactors(s, s.crop);
  s.quest = { id, diagnosed: false, solved: false, failed: false, startDay: s.day, notes: [] };
  addLog(s, 'quest', `Ситуаційний виклик: ${q.title}`, q.symptoms.join(' '));
  return s;
}

// ---------------------------------------------------------------------------
// Оцінювання рішень
// ---------------------------------------------------------------------------
export interface QPre { crust: number; pan: boolean; aMoist: number; emerged: boolean; mistakes: number; tSoil: number }
export interface QEvent { kind: 'till' | 'spray' | 'sow' | 'clear'; op: string; pre: QPre; eff?: number; inoculated?: boolean }

export function evaluateQuest(s: SimState, ev: QEvent) {
  const q = s.quest;
  if (!q || q.solved || q.failed) return;
  const ok = s.mistakes.length === ev.pre.mistakes;
  const c = liveCrop(s);
  const is = (kind: QEvent['kind'], ...ops: string[]) => ev.kind === kind && ops.includes(ev.op);
  switch (q.id) {
    case 'crust':
      if (is('till', 'rotaryHoe') && ev.pre.crust > 0 && c && !c.emerged && ok) questSolved(s, 'Кірку зруйновано на глибину 2–3 см без пошкодження проростків — сходи вийдуть на поверхню.');
      break;
    case 'frost':
      if (is('spray', 'antistress') && c?.id === 'corn' && c.growingPointAlive && ok) questSolved(s, 'Посів збережено: точка росту жива, антистресант пришвидшує відновлення листового апарату.');
      break;
    case 'pan':
      if (is('till', 'chisel') && ev.pre.pan && c && ok) questSolved(s, 'Глибоке розпушування відкрило корінню доступ до вологи горизонту B.');
      break;
    case 'septoria':
      if (is('spray', 'fungicide') && ok && (ev.eff ?? 0) >= 0.99) questSolved(s, 'Фунгіцид внесено без знесення: розвиток септоріозу зупинено, верхні листки захищено.');
      break;
    case 'nitrogen':
      if (is('spray', 'nitrogen') && c && ok) questSolved(s, 'Азот повернуто в зону активних коренів — посів відновить забарвлення за 7–10 діб.');
      break;
    case 'mites':
      if (is('spray', 'acaricide') && c && ok) questSolved(s, 'Акарицид знищив кліща та його яйця; ентомофаги збережені.');
      break;
    case 'wetsoil':
      if (((ev.kind === 'till' && TILLAGE[ev.op as keyof typeof TILLAGE]?.heavy) || ev.kind === 'sow') && ok && ev.pre.aMoist <= 80)
        questSolved(s, 'Техніку виведено у фізичну стиглість ґрунту — структура збережена, ущільнення немає.');
      break;
    case 'weeds':
      if ((is('spray', 'postHerbicide') || is('till', 'interRow')) && ok && s.weeds < EPSH_WEEDS) questSolved(s, `Забур'яненість знижено до ${Math.round(s.weeds)} шт./м² — нижче ЕПШ.`);
      break;
    case 'beetle':
      if (is('spray', 'insecticide') && c && ok) questSolved(s, 'Квіткоїда знищено до початку цвітіння — бджоли не постраждали.');
      break;
    case 'coldsoil':
      if (is('sow', 'corn')) {
        if (ok) questSolved(s, `Кукурудзу висіяно в прогрітий ґрунт (+${s.weather.tSoil} °C) — дружні сходи гарантовано.`);
        else questFailed(s, 'Посів кукурудзи виконано з порушенням технології.');
      }
      break;
    case 'acid':
      if (is('sow', 'soy')) {
        if (ok && ev.inoculated) questSolved(s, 'Ґрунт розкислено, насіння інокульоване — створено умови для активного симбіозу.');
        else questFailed(s, ok ? 'Сою висіяно без інокуляції.' : 'Посів сої виконано з порушенням технології.');
      }
      break;
    case 'lodging':
      if (is('spray', 'retardant') && c?.retardant && ok) questSolved(s, 'Ретардант внесено вчасно: нижні міжвузля вкорочено, ризик вилягання знижено.');
      break;
  }
}
