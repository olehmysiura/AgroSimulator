// ============================================================================
// Агротехнологічні операції + миттєвий розбір агрономічних помилок
// ============================================================================
import { CROPS, SPRAYS, TILLAGE, TOOLS, densityToRes } from './data';
import { detectCrisis, liveCrop, toolRelevance } from './diagnostics';
import { addLog, addMistake, newCrop, questFailed } from './engine';
import { evaluateQuest, type QPre } from './quests';
import { PAN_LIMIT, effRes, layer, panBlocking } from './soil';
import type { CropId, SimState, SprayMode, SprayOp, TillageOp, ToolId } from './types';
import { clamp, doy, fmt, round } from './util';

const anim = (s: SimState, kind: NonNullable<SimState['anim']>['kind'], extra: Partial<NonNullable<SimState['anim']>> = {}) => {
  s.anim = { kind, key: s.seq++, ...extra };
};

function recordOp(s: SimState, name: string) {
  s.operations.push({ day: s.day, name });
}

function pre(s: SimState): QPre {
  const c = liveCrop(s);
  return { crust: s.crust, pan: panBlocking(s), aMoist: layer(s, 'arable').moisture, emerged: !!c?.emerged, mistakes: s.mistakes.length, tSoil: s.weather.tSoil };
}

/** Вихід важкої техніки на перезволожений ґрунт (>80% НВ). */
function wetTrafficCheck(s: SimState, opName: string): boolean {
  const a = layer(s, 'arable');
  if (a.moisture <= 80) return false;
  const pan = layer(s, 'pan');
  a.density = 1.48;
  a.resistance = densityToRes(1.48);
  pan.resistance = Math.max(pan.resistance, 3.6);
  pan.density = Math.max(pan.density, 1.55);
  layer(s, 'seedbed').density = Math.max(layer(s, 'seedbed').density, 1.38);
  const c = liveCrop(s);
  if (c) c.losses.compaction = (c.losses.compaction ?? 1) * 0.9;
  addMistake(
    s,
    `${opName} на перезволоженому ґрунті (${fmt(a.moisture, 0)}% НВ)`,
    'За вологості понад 80% НВ ґрунт перебуває в пластичному стані: водяні плівки діють як мастило між агрегатами, і тиск коліс трактора (2–4 кг/см²) не розпушує, а спресовує структуру, витискаючи повітря з пор. Ґрунт «мажеться», утворюючи брили та глибу.',
    'Щільність горизонту A зросла до 1,48 г/см³, на глибині 30–35 см сформовано плужну підошву з опором 3,6 МПа. Погіршено аерацію та інфільтрацію, коріння наступних культур буде блоковане.',
  );
  if (s.quest?.id === 'wetsoil') questFailed(s, 'Техніку виведено на перезволожене поле.');
  return true;
}

function destroyCrop(s: SimState, opLabel: string, workDepth: number) {
  const c = liveCrop(s)!;
  const def = CROPS[c.id];
  if (!c.emerged && (s.crust > 0 || c.corkscrew)) {
    addMistake(
      s,
      `${opLabel} для руйнування кірки по посіву (${def.name})`,
      `Робочі органи агрегату заглиблюються на ~${fmt(workDepth, 0)} см — нижче за глибину загортання насіння (${fmt(c.depth)} см). Вони підрізають і вивертають на поверхню набубнявіле насіння з проростками, які за посушливої погоди висихають за кілька годин.`,
      'Проростки вирвано з ґрунту — посів загинув, польова схожість 0%. Поле доведеться пересівати з втратою строків сівби та вологи.',
    );
  } else if (c.id === 'corn' && c.stressCause === 'приморозок' && c.growingPointAlive && c.bbch < 16) {
    addMistake(
      s,
      `${opLabel} посіву кукурудзи після приморозку −2 °C`,
      'До фази 5–6 листків (BBCH <16) точка росту кукурудзи знаходиться під землею на глибині ~2,5 см і захищена ґрунтом, температура якого не опускалась нижче 0 °C. Від приморозку загинули лише листкові пластинки, конус наростання живий і здатний відновити листовий апарат за 5–7 діб.',
      'Знищено життєздатний посів. Пересів зсуває строки на 2–3 тижні: втрачається волога посівного шару, скорочується вегетаційний період — втрата 15–25% врожаю.',
    );
  } else {
    addMistake(
      s,
      `${opLabel} по вегетуючому посіву (${def.name}, BBCH ${c.bbch})`,
      `Агрегат суцільного обробітку працює на глибині ~${fmt(workDepth, 0)} см по всій ширині захвату: робочі органи підрізають, засипають та вивертають рослини культури разом з кореневою системою.`,
      'Посів знищено механічно.',
    );
  }
  c.dead = true;
  c.deathCause = `Знищено агрегатом: ${opLabel}`;
  questFailed(s, 'Посів знищено ґрунтообробним агрегатом.');
}

function panMisuse(s: SimState, opLabel: string, why: string, deepIntent = true) {
  const crisis = detectCrisis(s);
  // студент щойно виміряв підошву і обирає агрегат без конкретної іншої кризи
  const knowsPan = deepIntent && crisis === null && s.diagnostics.some((d) => d.tool === 'penetrometer' && s.day - d.day < 30);
  if (!panBlocking(s) || !(crisis === 'pan' || knowsPan)) return false;
  addMistake(
    s,
    `${opLabel} для руйнування плужної підошви (30–35 см)`,
    why,
    `Підплужна підошва залишилась: опір ${fmt(effRes(layer(s, 'pan')), 1)} МПа ≥ ${PAN_LIMIT} МПа. Коріння й надалі впирається у шар 30 см і не має доступу до вологи горизонту B.`,
  );
  return true;
}

const NOT_REACH = (name: string, depth: string) =>
  `${name} працює на глибині ${depth} — до підплужної підошви на 30–35 см залишається необроблений шар ґрунту. Розпушується лише верхня частина орного горизонту, а маса агрегату ще й додатково тисне на нижні шари.`;

// ---------------------------------------------------------------------------
// Механічний обробіток
// ---------------------------------------------------------------------------
export function till(s: SimState, op: TillageOp) {
  const def = TILLAGE[op];
  const p = pre(s);
  // стерню/загиблий посів прибираємо обробітком
  if (s.crop && (s.crop.dead || s.crop.harvested) && !['roll', 'rotaryHoe', 'harrow', 'interRow'].includes(op)) s.crop = null;
  const c = liveCrop(s);
  recordOp(s, def.name);
  anim(s, op);
  addLog(s, 'op', def.name, `Робоча глибина ${def.depth}.`);
  const wet = def.heavy ? wetTrafficCheck(s, def.name) : false;
  const surf = layer(s, 'surface');
  const sb = layer(s, 'seedbed');
  const a = layer(s, 'arable');
  const pan = layer(s, 'pan');
  const row = c ? CROPS[c.id].rowCrop : false;

  switch (op) {
    case 'plough': {
      panMisuse(s, 'Оранка плугом', 'Лемехи плуга підрізають скибу на глибині 25–27 см і не досягають шару 30–35 см. Більше того, правове колесо трактора йде по дну борозни та разом з п\'ятою полиці щороку спресовує ґрунт під лемехом — саме так і утворюється «плужна» підошва.');
      if (c) destroyCrop(s, 'Оранка', def.workDepth);
      s.residue = 4;
      s.weeds = round(s.weeds * 0.1, 1);
      surf.moisture -= 14; sb.moisture -= 12; a.moisture -= 8;
      if (!wet) { a.density = 1.08; a.resistance = densityToRes(1.08); sb.density = 1.02; }
      pan.resistance = round(pan.resistance + 0.15, 2);
      s.crust = 0;
      s.seedbedQuality = 0.35;
      addLog(s, 'info', 'Скибу обернуто', 'Стерню та бур\'яни заорано, верхній шар пересушено, поверхня брилиста. Дно борозни додатково ущільнене.');
      break;
    }
    case 'chisel': {
      if (c) {
        if (row && c.emerged && c.bbch >= 12) {
          c.losses.mechanical = (c.losses.mechanical ?? 1) * 0.98;
          addLog(s, 'info', 'Міжрядне глибоке розпушування (щілювання)', 'Стійки чизеля пройшли по міжряддях, частково обірвано бічні корені.');
        } else destroyCrop(s, 'Чизелювання', def.workDepth);
      }
      pan.resistance = wet ? 1.7 : 1.3;
      pan.density = Math.min(pan.density, 1.32);
      a.density = wet ? a.density : round(Math.max(1.12, a.density - 0.06), 2);
      a.resistance = densityToRes(a.density);
      layer(s, 'transition').resistance = Math.min(layer(s, 'transition').resistance, 1.8);
      s.residue = round(s.residue * 0.85, 0);
      addLog(s, 'info', 'Підплужну підошву зруйновано', `Опір шару 30–35 см: ${fmt(effRes(pan), 1)} МПа. Мульча на поверхні збережена (${s.residue}%).`);
      break;
    }
    case 'flatCut': {
      panMisuse(s, 'Плоскорізний обробіток', NOT_REACH('Плоскорізна лапа КПШ', '12–16 см'));
      if (c) destroyCrop(s, 'Плоскорізний обробіток', def.workDepth);
      s.residue = round(s.residue * 0.85, 0);
      s.weeds = round(s.weeds * 0.15, 1);
      if (!wet) { a.density = round(Math.max(1.12, a.density - 0.05), 2); a.resistance = densityToRes(a.density); }
      s.crust = 0;
      s.looseUntil = s.day + 20;
      addLog(s, 'info', 'Ґрунт підрізано без обертання скиби', `Стерня збережена на поверхні (${s.residue}%) — захист від вітрової ерозії та випаровування.`);
      break;
    }
    case 'stripTill': {
      panMisuse(s, 'Смуговий обробіток', NOT_REACH('Розпушувальна стійка strip-till', '20–25 см'));
      if (c) destroyCrop(s, 'Смуговий обробіток', def.workDepth);
      s.residue = round(s.residue * 0.7, 0);
      s.seedbedQuality = 0.85;
      if (!wet) { a.density = round(Math.max(1.1, a.density - 0.08), 2); a.resistance = densityToRes(a.density); sb.density = 1.12; }
      s.crust = 0;
      addLog(s, 'info', 'Розпушено смуги під рядки', 'У смугах шириною 25–30 см ґрунт розпушено та прогріто, міжряддя під мульчею.');
      break;
    }
    case 'disc': {
      panMisuse(s, 'Дискування', 'Дискові робочі органи обробляють лише шар 6–12 см. До підплужної підошви на 30–35 см залишається понад 20 см необробленого ґрунту, а маса важкої дискової борони додатково ущільнює нижні шари.');
      if (c) destroyCrop(s, 'Дискування', def.workDepth);
      s.residue = round(s.residue * 0.5, 0);
      s.weeds = round(s.weeds * 0.3, 1);
      s.weedFlush += 6;
      surf.moisture -= 6; sb.moisture -= 5;
      s.crust = 0;
      s.seedbedQuality = 0.6;
      addLog(s, 'info', 'Стерню подрібнено та змішано з ґрунтом', 'Насіння бур\'янів загорнуто в теплий вологий шар — очікується хвиля проростання.');
      break;
    }
    case 'stubbleDisc': {
      panMisuse(s, 'Лущення стерні', NOT_REACH('Дисковий лущильник', '6–8 см'));
      if (c) destroyCrop(s, 'Лущення', def.workDepth);
      s.residue = round(s.residue * 0.7, 0);
      s.weedFlush += 4;
      s.weeds = round(s.weeds * 0.4, 1);
      s.looseUntil = s.day + 25;
      s.crust = 0;
      addLog(s, 'info', 'Стерню проміщено', 'Розірвано капіляри — випаровування зменшено; насіння бур\'янів спровоковано до проростання.');
      break;
    }
    case 'cultivate': {
      panMisuse(s, 'Культивація', 'Лапи культиватора працюють на глибині 5–6 см, тобто в 5–6 разів мілкіше за залягання підошви (30–35 см). Розпушується лише посівний шар, а ущільнений горизонт під орним шаром залишається непорушеним.');
      if (c) destroyCrop(s, 'Суцільна культивація', def.workDepth);
      else {
        s.weeds = round(s.weeds * 0.08, 1);
        s.seedbedQuality = 0.95;
        sb.moisture -= 3;
        surf.moisture -= 4;
        s.residue = round(s.residue * 0.85, 0);
        if (!wet) sb.density = 1.1;
        addLog(s, 'info', 'Посівне ложе підготовлено', 'Дрібногрудочкувата структура, ущільнене ложе на глибині 5–6 см, бур\'яни підрізано.');
      }
      s.crust = 0;
      break;
    }
    case 'harrow': {
      panMisuse(s, 'Боронування', NOT_REACH('Зубова борона', '3–4 см'), false);
      if (c && !c.emerged && c.depth <= 4) {
        addMistake(
          s,
          `Досходове боронування мілкого посіву (${CROPS[c.id].name}, ${fmt(c.depth)} см)`,
          `Зуби борони заглиблюються на 3–4 см, а насіння покладене на ${fmt(c.depth)} см: зуби зачіпають і виривають насінини з проростками.`,
          'Польова схожість знизилась приблизно на третину.',
        );
        c.germPotential = round(c.germPotential * 0.65, 0);
      } else if (c && !c.emerged && s.crust > 0) {
        addMistake(
          s,
          'Зубова борона по кірці над проростками',
          'Жорсткі зуби ламають кірку великими плитками та тягнуть їх по поверхні; проростки, що вже підійшли під кірку, травмуються і обриваються разом з плитками.',
          'Кірку зруйновано, але близько 30% проростків загинуло.',
        );
        c.germPotential = round(c.germPotential * 0.7, 0);
        c.corkscrew = false;
        questFailed(s, 'Частину проростків знищено зубовою бороною.');
      } else if (c && c.emerged && c.bbch > 14 && c.id !== 'wheat') {
        c.losses.mechanical = (c.losses.mechanical ?? 1) * 0.94;
        addLog(s, 'warn', 'Боронування по вегетуючих рослинах', 'Частину рослин травмовано та присипано ґрунтом.');
      }
      s.crust = 0;
      s.looseUntil = s.day + 18;
      s.weeds = round(s.weeds * 0.6, 1);
      addLog(s, 'info', 'Поверхню розпушено на 3–4 см', 'Капіляри розірвано, вологу «закрито»; знищено бур\'яни в фазі білої ниточки.');
      break;
    }
    case 'mulcher': {
      if (c) destroyCrop(s, 'Мульчування', 3);
      s.residue = Math.max(s.residue, 30);
      s.weeds = round(s.weeds * 0.7, 1);
      addLog(s, 'info', 'Рослинні рештки подрібнено', 'Стебла розщеплено на фракцію 5–8 см: прискорено розкладання, зруйновано місця зимівлі стеблового метелика.');
      break;
    }
    case 'rotaryHoe': {
      panMisuse(s, 'Ротаційна борона', 'Голчасті диски ротаційної борони заглиблюються лише на 2–3 см і призначені для поверхні; на підплужну підошву на 30–35 см вони не впливають.', false);
      if (s.crust > 0) {
        const hadCrust = s.crust;
        s.crust = 0;
        surf.density = 1.05;
        addLog(s, 'info', 'Ґрунтову кірку зруйновано', `Кірку ${fmt(hadCrust)} см розбито на дрібні грудочки; насіння на глибині ${c ? fmt(c.depth) : '—'} см не зачеплено.`);
        if (c && !c.emerged) c.corkscrew = false;
      } else addLog(s, 'info', 'Поверхню розпушено', 'Кірки не було; знищено ниткоподібні проростки бур\'янів.');
      s.weeds = round(s.weeds * 0.55, 1);
      surf.moisture -= 2;
      break;
    }
    case 'interRow': {
      if (!c) {
        addLog(s, 'warn', 'Міжрядна культивація без посіву', 'Міжрядь немає — агрегат відпрацював як мілка культивація.');
        s.weeds = round(s.weeds * 0.3, 1);
        break;
      }
      if (!row) {
        addMistake(
          s,
          `Міжрядна культивація суцільного посіву (${CROPS[c.id].name})`,
          `${CROPS[c.id].name} висівається рядковим способом з міжряддям 12,5–15 см: лапи міжрядного культиватора (захват 30–45 см) не вміщаються між рядками і підрізають рослини.`,
          'Знищено ~45% рослин.',
        );
        c.stand = round(c.stand * 0.55, 0);
        break;
      }
      if (!c.emerged || c.bbch < 12) {
        addLog(s, 'warn', 'Рядки ще не позначились', 'Без видимих рядків агрегат не можна точно навести — оброблено з захисною зоною 15 см.');
      } else if (c.bbch >= 32) {
        addMistake(
          s,
          `Міжрядна культивація після змикання рядків (${CROPS[c.id].name}, BBCH ${c.bbch})`,
          'Після змикання міжрядь бічні корені займають усе міжряддя на глибині 5–10 см. Лапи культиватора обривають активну кореневу систему, а трактор ламає листя та стебла.',
          'Обірвано ~25% коренів, механічні пошкодження рослин — втрата 8% урожаю.',
        );
        c.losses.mechanical = (c.losses.mechanical ?? 1) * 0.92;
      }
      if (s.crust > 0) s.crust = 0;
      s.weeds = round(s.weeds * 0.25, 1);
      s.looseUntil = s.day + 15;
      addLog(s, 'info', 'Міжряддя оброблено', `Бур'яни в міжряддях підрізано (${fmt(s.weeds, 0)} шт./м²), рослини підгорнуто.`);
      break;
    }
    case 'roll': {
      if (s.crust > 0) {
        addMistake(
          s,
          'Коткування по ґрунтовій кірці',
          'Коток не руйнує кірку, а додатково притискає її: зв\'язні мулисті частки ущільнюються, капілярний підйом підсилює випаровування з поверхні. Механічний опір кірки для проростків зростає.',
          'Кірка стала щільнішою (+0,4 см), сходи й далі не можуть пробитися на поверхню.',
        );
        s.crust = round(s.crust + 0.4, 1);
      } else if (c && c.emerged && c.bbch > 12) {
        c.losses.mechanical = (c.losses.mechanical ?? 1) * 0.96;
        addLog(s, 'warn', 'Коткування по сходах', 'Частину листків прим\'ято та травмовано.');
      } else {
        sb.moisture += 4;
        surf.density = round(surf.density + 0.06, 2);
        if (c && !c.emerged) c.seedContact = 1;
        addLog(s, 'info', 'Поверхню прикотковано', 'Покращено контакт насіння з ґрунтом, волога підтягнута до зони насіння.');
      }
      panMisuse(s, 'Коткування', 'Коток діє лише на поверхню, ущільнюючи її; на шар 30–35 см він не здатен вплинути, а розпушувального ефекту не має взагалі.', false);
      break;
    }
  }
  for (const l of s.layers) l.moisture = clamp(l.moisture, 6, 130);
  evaluateQuest(s, { kind: 'till', op, pre: p });
}

// ---------------------------------------------------------------------------
// Посів / пересів
// ---------------------------------------------------------------------------
export function sow(s: SimState, id: CropId, depth: number, seedTreatment: boolean, inoculated: boolean) {
  const def = CROPS[id];
  if (liveCrop(s)) {
    addLog(s, 'warn', 'Посів неможливий', 'Поле зайняте вегетуючою культурою.');
    return;
  }
  const p = pre(s);
  s.crop = null;
  recordOp(s, `Посів: ${def.name} на ${fmt(depth)} см`);
  anim(s, 'sow');
  addLog(s, 'op', `Посів: ${def.name}`, `Глибина загортання ${fmt(depth)} см; протруйник: ${seedTreatment ? 'так' : 'ні'}; інокуляція: ${inoculated ? 'так' : 'ні'}.`);
  wetTrafficCheck(s, 'Посів сівалкою');

  const c = newCrop(id, s.day, depth, seedTreatment, inoculated && id === 'soy');
  let germ = 95;
  const tSoil = s.weather.tSoil;
  const sb = layer(s, 'seedbed');
  const d = doy(s.day);

  // ---- глибина
  const dev = depth < def.depthMin ? def.depthMin - depth : depth > def.depthMax ? depth - def.depthMax : 0;
  const fDepth = clamp(1 - dev * def.depthSensitivity * 1.2, 0.2, 1);
  germ *= fDepth;
  if (dev >= 1) {
    const shallow = depth < def.depthMin;
    addMistake(
      s,
      `Порушення глибини висіву: ${def.name} на ${fmt(depth)} см (агровимога ${fmt(def.depthMin)}–${fmt(def.depthMax)} см)`,
      shallow
        ? `Насіння покладено в шар 0–${fmt(depth + 0.5)} см, який пересихає першим (вологість посівного шару зараз ${fmt(sb.moisture, 0)}% НВ і падає з кожним сонячним днем). Насінню бракує контакту з вологим ґрунтом для набубнявіння${id === 'corn' ? ' (кукурудзі потрібно поглинути ~40% води від власної маси)' : ''}; вузол кущіння та вторинні корені закладаються майже на поверхні, рослини погано закріплені.`
        : `Для виходу на поверхню з глибини ${fmt(depth)} см проростку не вистачає запасу поживних речовин ${def.epigeal ? 'сім\'ядолей (гіпокотиль повинен винести сім\'ядолі на поверхню)' : 'ендосперму'}${id === 'rapeseed' ? ' — маса 1000 насінин ріпаку лише 4–6 г' : ''}. Глибше — холодніше й менше кисню: проросток етіолюється, виснажується й довше уражується ґрунтовими патогенами.`,
      `Польова схожість знизиться приблизно до ${Math.round(germ)}%, сходи будуть зрідженими та нерівномірними.`,
    );
  }
  // ---- холодний ґрунт
  if (tSoil < def.baseTemp) {
    const f = tSoil < def.baseTemp - 3 ? 0.68 : 0.85;
    germ *= f;
    addMistake(
      s,
      `Посів у холодний ґрунт: ${def.name} при +${fmt(tSoil)} °C на глибині загортання`,
      `Біологічний мінімум проростання культури — +${def.baseTemp} °C. Нижче цього порогу амілази й протеази, що розщеплюють запасні речовини насінини, майже неактивні: насіння набубнявіє, але не проростає, «лежить» у ґрунті тижнями і уражується пліснявими грибами (Fusarium, Pythium, Penicillium).`,
      `Польова схожість знизиться до ~${Math.round(germ)}%, сходи розтягнуться в часі; без протруйника втрати подальшим пліснявінням ще більші.`,
    );
  }
  // ---- озимі навесні/влітку
  if (def.winter && d > 60 && d < 215) {
    c.losses.vernal = 0.1;
    addMistake(
      s,
      `Посів озимої культури (${def.name}) навесні/влітку`,
      'Озимим формам для переходу до генеративної фази необхідна яровизація — 40–60 діб за температур 0…+7 °C. При весняному/літньому посіві умови яровизації не настають, і рослини залишаються в фазі кущіння/розетки.',
      'Культура не сформує генеративних органів (колосу/стручків) — врожайність близька до нуля.',
    );
  }
  // ---- ярі культури восени
  if (!def.winter && (d > 215 || d < 60)) {
    c.losses.lateSowing = 0.05;
    addMistake(
      s,
      `Посів теплолюбної ярої культури (${def.name}) наприкінці літа / восени`,
      `Для повного циклу ${def.name.toLowerCase()} потрібна сума ефективних температур, якої до осінніх заморозків уже не буде; сходи загинуть від перших морозів.`,
      'Культура не встигне сформувати урожай.',
    );
  }
  // ---- соя на кислому ґрунті
  if (id === 'soy' && sb.pH < 5.5) {
    c.losses.acid = 0.8;
    addMistake(
      s,
      `Посів сої на кислому ґрунті без вапнування (pH ${fmt(sb.pH)})`,
      'Бульбочкові бактерії Bradyrhizobium japonicum активні за pH 6,0–7,0. На кислих ґрунтах пригнічується інфікування кореневих волосків, у розчин переходить рухомий алюміній, токсичний для коренів, знижується доступність молібдену — кофактора нітрогенази.',
      'Бульбочок мало, вони білі (неактивні): соя житиме за рахунок ґрунтового азоту — втрата 20% і більше.',
    );
  }
  // ---- інокулянт не для бобових
  if (inoculated && id !== 'soy') {
    addMistake(
      s,
      `Інокуляція бульбочковими бактеріями насіння культури ${def.name}`,
      'Бульбочкові бактерії (Bradyrhizobium japonicum) утворюють симбіоз лише з коренями бобових — сої. У небобових культур немає флавоноїдних сигналів та кореневих волосків, здатних утворити бульбочки.',
      'Азотфіксація не відбуватиметься, обробка не має жодного агрономічного ефекту.',
    );
  }
  if (sb.moisture < 40) {
    germ *= 0.82;
    addLog(s, 'warn', 'Сухе посівне ложе', `Вологість шару 2–8 см ${fmt(sb.moisture, 0)}% НВ — набубнявіння сповільнене.`);
  }
  if (s.residue > 55 && s.seedbedQuality < 0.8) {
    germ *= 0.9;
    addLog(s, 'warn', 'Рештки в борозні', 'Частина насінин потрапила на нероздрібнену солому («хейпінг») — погіршено контакт з ґрунтом.');
  }
  germ *= 0.85 + 0.15 * s.seedbedQuality;
  if (!seedTreatment) germ *= 0.95;
  // ---- запізнення строків (весняні культури)
  if (!def.winter && d > 150 && d <= 215) c.losses.lateSowing = round(clamp(1 - (d - 150) * 0.009, 0.4, 1), 3);
  if (def.winter && d > 285) c.losses.lateSowing = round(clamp(1 - (d - 285) * 0.012, 0.5, 1), 3);
  c.germPotential = Math.round(clamp(germ, 0, 98));
  c.seedbedQuality = s.seedbedQuality;
  s.crop = c;
  s.weeds = round(s.weeds * 0.9, 1);
  evaluateQuest(s, { kind: 'sow', op: id, pre: p, inoculated });
}

export function clearCrop(s: SimState) {
  const c = s.crop;
  if (!c) return;
  const p = pre(s);
  recordOp(s, 'Списання посіву');
  anim(s, 'clear');
  const live = liveCrop(s);
  if (live) {
    const def = CROPS[live.id];
    if (live.id === 'corn' && live.stressCause === 'приморозок' && live.growingPointAlive && live.bbch < 16) {
      addMistake(
        s,
        'Списання / пересів кукурудзи після приморозку −2 °C у фазі 3 листків',
        'До фази 5–6 листків (BBCH <16) точка росту кукурудзи розміщена під землею на глибині ~2,5 см. Ґрунт має велику теплоємність, і на цій глибині температура залишалась вище 0 °C — конус наростання вижив. Почорніння листя — пошкодження лише асиміляційної поверхні, яку рослина відновить за 5–7 діб.',
        'Знищено життєздатний посів. Пересів зсуває строки сівби на 2–3 тижні: втрата вологи посівного шару, коротший вегетаційний період і втрата 15–25% врожаю.',
      );
      questFailed(s, 'Життєздатний посів кукурудзи списано.');
    } else if ((live.emerged ? live.stand : live.germPotential) >= 50 && live.health >= 35) {
      addMistake(
        s,
        `Списання життєздатного посіву (${def.name}, BBCH ${live.bbch})`,
        `Густота/потенційна схожість посіву ще становить ${Math.round(live.emerged ? live.stand : live.germPotential)}% від цільової — цього достатньо для формування врожаю за умови усунення причини стресу. Рішення про пересів ухвалюють лише за фактичною густотою нижче економічно виправданого порогу (40–50%).`,
        'Посів знищено; новий посів матиме запізнілі строки та втрачену вологу посівного шару.',
      );
      questFailed(s, 'Життєздатний посів списано.');
    } else addLog(s, 'info', 'Посів списано', `Густота ${Math.round(live.stand)}% — нижче порогу доцільності.`);
  } else addLog(s, 'op', 'Рештки посіву прибрано', 'Поле вільне для наступного посіву.');
  s.crop = null;
  evaluateQuest(s, { kind: 'clear', op: 'clear', pre: p });
}

// ---------------------------------------------------------------------------
// ЗЗР та живлення
// ---------------------------------------------------------------------------
export function setSprayMode(s: SimState, m: SprayMode) {
  if (s.sprayMode === m) return;
  s.sprayMode = m;
  addLog(s, 'op', m === 'evening' ? 'Обприскувач: вечірня зміна + інжекторні розпилювачі' : 'Обприскувач: денна зміна', m === 'evening' ? 'Робота після 19:00 за затухання вітру; ежекторні розпилювачі формують краплі 300–500 мкм.' : 'Робота у світлий час доби зі стандартними щілинними розпилювачами.');
}

export function effectiveWind(s: SimState) {
  return s.sprayMode === 'evening' ? Math.min(s.weather.wind, 2.1) : s.weather.wind;
}

export function spray(s: SimState, op: SprayOp) {
  const def = SPRAYS[op];
  const p = pre(s);
  if (s.crop && (s.crop.dead || (s.crop.harvested && op !== 'desiccant'))) s.crop = null;
  const c = liveCrop(s);
  const wind = effectiveWind(s);
  recordOp(s, def.name);
  if (def.spreader) anim(s, 'spread');
  else anim(s, 'spray', { drift: wind > 5, evening: s.sprayMode === 'evening' });
  addLog(s, 'op', def.name, def.spreader ? `${def.detail}; відцентровий розкидач.` : `${def.detail}; ${s.sprayMode === 'evening' ? 'вечірня зміна, інжекторні розпилювачі' : 'денна зміна'}; вітер ${fmt(wind)} м/с.`);

  let eff = 1;
  if (!def.spreader && wind > 5) {
    eff = 0.35;
    addMistake(
      s,
      `Обприскування (${def.name}) при вітрі ${fmt(wind)} м/с`,
      'За швидкості вітру понад 4–5 м/с дрібні краплі (<150 мкм) зі стандартних щілинних розпилювачів горизонтально зносяться повітряним потоком і випаровуються до осідання на листя. Утворюється «хмара» препарату, що дрейфує на сотні метрів.',
      '≈65% препарату знесено вітром за межі поля (ризик для сусідніх культур, пасік, водойм). Фактична ефективність обробки — лише 35%.',
    );
    if (c) c.losses.drift = (c.losses.drift ?? 1) * 0.99;
  }
  if (!def.spreader && s.weather.tMax > 27 && s.sprayMode === 'day' && ['postHerbicide', 'fungicide', 'insecticide', 'acaricide', 'micro', 'nitrogen'].includes(op)) {
    eff *= 0.75;
    addLog(s, 'warn', 'Обприскування у спеку', `Температура +${fmt(s.weather.tMax)} °C: краплі випаровуються до поглинання, продихи закриті — ефективність знижена.`);
  }
  const sb = layer(s, 'seedbed');
  const a = layer(s, 'arable');
  const pestKind = c ? CROPS[c.id].pest.kind : 'insect';
  switch (op) {
    case 'nitrogen': {
      a.nitrogen += 12 * eff;
      sb.nitrogen += 6 * eff;
      layer(s, 'surface').nitrogen += 4 * eff;
      if (c && c.emerged && c.nStatus > 1.15) {
        addMistake(
          s,
          `Азотне підживлення при надлишку азоту (N-статус ${fmt(c.nStatus, 2)})`,
          'Рослина вже забезпечена азотом: надлишковий N затягує вегетативний ріст, стебла видовжуються й тоншають, послаблюються механічні тканини, сповільнюється дозрівання; надлишок нітратів вимивається у ґрунтові води.',
          'Зросте ризик вилягання та ураження хворобами; азот використано неефективно.',
        );
      }
      addLog(s, 'info', 'Азот внесено', `Вміст доступного N у горизонті A: ${fmt(a.nitrogen, 0)} мг/кг.`);
      break;
    }
    case 'pk': {
      s.nutrients.P2O5 = round(s.nutrients.P2O5 + 18, 0);
      s.nutrients.K2O = round(s.nutrients.K2O + 22, 0);
      if (c) c.health = Math.min(100, c.health + 4);
      addLog(s, 'info', 'Фосфор і калій внесено', `P₂O₅ ${s.nutrients.P2O5} мг/кг, K₂O ${s.nutrients.K2O} мг/кг.`);
      break;
    }
    case 'micro': {
      s.nutrients.B = round(s.nutrients.B + 0.15 * eff, 2);
      s.nutrients.Zn = round(s.nutrients.Zn + 0.2 * eff, 2);
      if (c && c.emerged) c.health = Math.min(100, c.health + 6 * eff);
      addLog(s, 'info', 'Мікроелементи внесено по листу', 'B, Zn, Mn у хелатній формі поглинаються листком за 2–6 год.');
      break;
    }
    case 'liming': {
      if (a.pH >= 6.2) {
        addMistake(
          s,
          `Вапнування нейтрального/лужного ґрунту (pH ${fmt(a.pH)})`,
          'Вапнування показане лише кислим ґрунтам (pH(KCl) < 5,5). На нейтральних і карбонатних чорноземах надлишок Ca²⁺ підлужує розчин: фосфати переходять у важкорозчинні фосфати кальцію, знижується доступність B, Zn, Mn, Fe.',
          'Погіршено доступність фосфору та мікроелементів; меліорант використано безпідставно.',
        );
        s.nutrients.Zn = round(s.nutrients.Zn * 0.8, 2);
        s.nutrients.B = round(s.nutrients.B * 0.85, 2);
      }
      for (const l of s.layers.slice(0, 3)) l.pH = round(Math.min(7.4, l.pH + 0.9), 1);
      addLog(s, 'info', 'Вапняне борошно внесено', `pH шару 0–30 см: ${fmt(a.pH)}.`);
      break;
    }
    case 'preHerbicide': {
      if (c && c.emerged) {
        addMistake(
          s,
          'Ґрунтовий досходовий гербіцид по сходах культури',
          'Досходові гербіциди формують екран у шарі 0–3 см і діють на проростки бур\'янів у момент їхнього проходження через нього. Бур\'яни, що вже зійшли й укорінились, поглинають д.р. слабко; до того ж частина препарату осідає на листі культури.',
          'Наявні бур\'яни не знищено, екран лише частково обмежить нову хвилю.',
        );
        s.preHerbUntil = s.day + 20;
        break;
      }
      if (sb.moisture < 45) {
        addMistake(
          s,
          `Ґрунтовий гербіцид у сухий ґрунт (${fmt(sb.moisture, 0)}% НВ у шарі 2–8 см)`,
          'Ґрунтові гербіциди активуються лише у ґрунтовому розчині: для формування суцільного екрану потрібна вологість посівного шару понад 45–50% НВ або 10–15 мм опадів протягом 7–10 діб після внесення. У сухому ґрунті діюча речовина адсорбується на поверхні, руйнується ультрафіолетом і випаровується.',
          'Гербіцидний екран не сформовано — бур\'яни проростатимуть без обмежень.',
        );
        s.preHerbUntil = s.day + 3;
        break;
      }
      s.preHerbUntil = s.day + Math.round(45 * eff);
      s.weeds = round(s.weeds * (1 - 0.5 * eff), 1);
      addLog(s, 'info', 'Гербіцидний екран сформовано', `Захисна дія до ~${Math.round(45 * eff)} діб.`);
      break;
    }
    case 'postHerbicide': {
      if (c && c.emerged) {
        const stressed = c.stressUntil >= s.day || c.wilting || c.waterSupply < 0.3;
        if (stressed) {
          addMistake(
            s,
            `Страховий гербіцид по стресованій культурі (${c.wilting || c.waterSupply < 0.3 ? 'посуха' : c.stressCause})`,
            'Селективність післясходових гербіцидів базується на тому, що культура швидко детоксикує д.р. ферментами (цитохром P450, глутатіон-S-трансфераза). У рослини, пригніченої приморозком чи посухою, метаболізм і ці ферментні системи загальмовані — гербіцид накопичується в тканинах і діє на культуру як на бур\'ян.',
            'Жорстка фітотоксичність: хлороз, деформація листя, зупинка росту на 10–14 діб; втрата ~18% врожаю.',
          );
          c.losses.phyto = (c.losses.phyto ?? 1) * 0.82;
          c.health = Math.max(10, c.health - 25);
          c.stressUntil = Math.max(c.stressUntil, s.day) + 10;
        } else if (c.bbch > 32) {
          addMistake(
            s,
            `Страховий гербіцид після BBCH 32 (${CROPS[c.id].name}, BBCH ${c.bbch})`,
            'Після фази другого міжвузля в рослині вже диференційовано генеративні органи (колос у трубці, суцвіття). Гербіцид порушує ділення клітин у меристемах, а бур\'яни під пологом вже переросли чутливу фазу 2–4 листків.',
            'Жорстка фітотоксичність: деформація колосу/суцвіть, череззерниця, втрата ~15% врожаю; бур\'яни знищено лише частково.',
          );
          c.losses.phyto = (c.losses.phyto ?? 1) * 0.85;
          c.health = Math.max(10, c.health - 15);
          eff *= 0.5;
        }
      }
      s.weeds = round(s.weeds * (1 - 0.85 * eff), 1);
      addLog(s, 'info', 'Бур\'яни оброблено', `Чисельність бур'янів: ${fmt(s.weeds, 0)} шт./м².`);
      break;
    }
    case 'glyphosate': {
      if (c && c.emerged) {
        addMistake(
          s,
          `Гербіцид суцільної дії по вегетуючій культурі (${CROPS[c.id].name})`,
          'Гліфосат — неселективний системний гербіцид: блокує фермент EPSPS шикіматного шляху синтезу ароматичних амінокислот у всіх зелених рослинах і пересувається до точок росту та коренів. Культура не має механізму його детоксикації.',
          'Посів повністю загине протягом 7–14 діб.',
        );
        c.dead = true;
        c.deathCause = 'Знищено гербіцидом суцільної дії.';
        questFailed(s, 'Посів знищено гербіцидом суцільної дії.');
      }
      if (s.weather.tAir < 8) {
        addLog(s, 'warn', 'Гліфосат у холод', 'За температури нижче +8 °C бур\'яни слабко поглинають і пересувають д.р. — ефективність знижена.');
        eff *= 0.5;
      }
      s.weeds = round(s.weeds * (1 - 0.95 * eff), 1);
      addLog(s, 'info', 'Вегетуючі бур\'яни знищено', `Залишилось ${fmt(s.weeds, 0)} шт./м² (без ґрунтової дії).`);
      break;
    }
    case 'fungicide': {
      if (!c) { addLog(s, 'warn', 'Обробка без вегетуючої культури', 'Цільового об\'єкта немає.'); break; }
      if (c.pests > 6 && c.disease < 10) {
        addMistake(
          s,
          `Фунгіцид проти ${pestKind === 'mite' ? 'кліщів' : 'комах-шкідників'}`,
          'Триазоли пригнічують біосинтез ергостеролу клітинних мембран грибів, стробілурини блокують мітохондріальне дихання грибів (комплекс III). На нервову систему та покриви членистоногих ці речовини не діють.',
          `Чисельність шкідників не змінилась (${fmt(c.pests)} ${CROPS[c.id].pest.unit}), пошкодження рослин продовжується.`,
        );
        c.fungicideUntil = s.day + 14;
        break;
      }
      const before = c.disease;
      c.disease = round(c.disease * (1 - 0.72 * eff), 1);
      c.fungicideUntil = s.day + Math.round(24 * eff);
      addLog(s, 'info', 'Фунгіцидний захист', `Ураження: ${fmt(before)}% → ${fmt(c.disease)}%, захисна дія ~${Math.round(24 * eff)} діб.`);
      break;
    }
    case 'insecticide': {
      if (!c) { addLog(s, 'warn', 'Обробка без вегетуючої культури', 'Цільового об\'єкта немає.'); break; }
      if (c.disease > 15 && c.pests < 5) {
        addMistake(
          s,
          'Інсектицид проти грибкової хвороби',
          'Інсектициди діють на нервову систему комах (нікотинові ацетилхолінові рецептори, натрієві канали нейронів). Грибний патоген не має нервової системи — на міцелій, пікніди та спори препарат не впливає.',
          `Хвороба прогресує (ураження ${fmt(c.disease)}%), знищено корисну ентомофауну (сонечок, золотоочок).`,
        );
        c.insecticideUntil = s.day + 14;
        break;
      }
      if (pestKind === 'mite' && c.pests > 2) {
        addMistake(
          s,
          'Інсектицид проти павутинного кліща',
          'Кліщі — не комахи, а павукоподібні (Acari): неонікотиноїди на них майже не діють, а піретроїди знищують хижих кліщів (фітосейулюс) та трипсів-ентомофагів. Після такої обробки популяція павутинного кліща різко зростає — класичний ефект «резургенції».',
          'Чисельність кліща не знизилась, а через знищення ентомофагів зросте ще в 1,5 раза.',
        );
        c.pests = round(c.pests * 1.5, 1);
        break;
      }
      const def2 = CROPS[c.id];
      if (def2.beePollinated && c.bbch >= 60 && c.bbch <= 69 && s.sprayMode === 'day') {
        c.losses.bees = 0.65;
        addMistake(
          s,
          `Інсектицид удень під час цвітіння (${def2.name}, BBCH ${c.bbch})`,
          'У фазу цвітіння з 9 до 18 години на полі масово працюють бджоли та джмелі — основні запилювачі культури. Системно-контактні інсектициди (неонікотиноїди, піретроїди) мають гостру токсичність для бджіл (LD50 < 0,1 мкг/особину) і діють як при контакті, так і через нектар.',
          'Масова загибель бджіл-запилювачів, недозапилення кошиків/суцвіть: втрата врожайності 35%.',
        );
      }
      c.pests = round(c.pests * (1 - 0.9 * eff), 1);
      c.insecticideUntil = s.day + Math.round(16 * eff);
      addLog(s, 'info', 'Інсектицидна обробка', `Чисельність шкідників: ${fmt(c.pests)} ${def2.pest.unit}.`);
      break;
    }
    case 'acaricide': {
      if (!c) { addLog(s, 'warn', 'Обробка без вегетуючої культури', 'Цільового об\'єкта немає.'); break; }
      if (pestKind !== 'mite' && c.pests > 2) {
        addMistake(
          s,
          `Акарицид проти комах (${CROPS[c.id].pest.name})`,
          'Специфічні акарициди (спіродиклофен, гекситіазокс) порушують ліпідний обмін та линяння саме кліщів; на більшість комах вони не діють або діють слабко.',
          `Чисельність шкідника (${CROPS[c.id].pest.name}) не змінилась.`,
        );
        break;
      }
      c.pests = round(c.pests * (1 - 0.92 * eff), 1);
      c.insecticideUntil = s.day + Math.round(21 * eff);
      addLog(s, 'info', 'Акарицидна обробка', `Чисельність кліща: ${fmt(c.pests)} ос./листок; діє на яйця та личинки.`);
      break;
    }
    case 'retardant': {
      if (!c || !c.emerged) { addLog(s, 'warn', 'Обробка без вегетуючої культури', 'Цільового об\'єкта немає.'); break; }
      if (c.id !== 'wheat' && c.id !== 'rapeseed') {
        addMistake(
          s,
          `Ретардант на культурі ${CROPS[c.id].name}`,
          'Хлормекват-хлорид і тринексапак-етил зареєстровані для зернових колосових та ріпаку: вони гальмують синтез гіберелінів і вкорочують міжвузля. Для цієї культури вкорочення стебла не є технологічною потребою, а реакція на д.р. — фітотоксична.',
          'Затримка росту, деформація листя — втрата ~6% урожаю.',
        );
        c.losses.phyto = (c.losses.phyto ?? 1) * 0.94;
        break;
      }
      if (c.id === 'wheat' && c.bbch > 37) {
        addMistake(
          s,
          `Ретардант після BBCH 37 (пшениця, BBCH ${c.bbch})`,
          'Оптимальне вікно для ретардантів — BBCH 30–32 (початок виходу в трубку), коли закладаються нижні міжвузля. Пізніше препарат діє на верхнє міжвузля та колос у піхві прапорцевого листка.',
          'Колос деформується, «застрягає» в піхві, череззерниця — втрата 8% урожаю, а ризик вилягання вже майже не знижено.',
        );
        c.losses.retard = 0.92;
        break;
      }
      c.retardant = true;
      addLog(s, 'info', 'Ретардант внесено', 'Нижні міжвузля вкорочуються та потовщуються, стебло стає міцнішим.');
      break;
    }
    case 'desiccant': {
      if (!c || !c.emerged) { addLog(s, 'warn', 'Обробка без вегетуючої культури', 'Цільового об\'єкта немає.'); break; }
      if (!['sunflower', 'rapeseed', 'soy'].includes(c.id)) {
        addMistake(
          s,
          `Десикація культури ${CROPS[c.id].name}`,
          c.id === 'sugarbeet' ? 'У цукрового буряка листя постачає асиміляти до коренеплоду до самого збирання; десикант зупиняє цукронакопичення та провокує відростання нового листя за рахунок цукру.' : 'Зернові та кукурудза дозрівають рівномірно і віддають вологу самостійно; десикація для них технологічно не потрібна і знищує листя, що ще наливає зерно.',
          'Недобір урожаю ~15%.',
        );
        c.losses.desiccEarly = 0.85;
        c.desiccated = true;
        break;
      }
      if (c.bbch < 85) {
        addMistake(
          s,
          `Передчасна десикація (${CROPS[c.id].name}, BBCH ${c.bbch})`,
          'Десикант застосовують у фазі фізіологічної стиглості (BBCH 85–87, вологість насіння 30–35%), коли налив завершено. Раніше припиняється надходження асимілятів у насіння — воно залишається щуплим, з низькою олійністю.',
          'Недолив насіння: втрата 15–25% урожаю та якості.',
        );
        c.losses.desiccEarly = c.bbch < 79 ? 0.75 : 0.85;
      }
      c.desiccated = true;
      addLog(s, 'info', 'Десикацію виконано', 'Листя та стебла підсихають; збирання — через 7–10 діб.');
      break;
    }
    case 'antistress': {
      if (!c || !c.emerged) { addLog(s, 'warn', 'Обробка без вегетуючої культури', 'Листкової поверхні для поглинання немає.'); break; }
      const stressed = c.stressUntil >= s.day || c.wilting;
      c.health = Math.min(100, c.health + 18 * eff);
      if (stressed) {
        c.stressUntil = s.day + 1;
        c.leafFrost = Math.max(0, c.leafFrost - 0.25 * eff);
        addLog(s, 'info', 'Антистресант поглинуто листям', 'Амінокислоти та гумати пришвидшують відновлення синтезу білка й хлорофілу.');
      } else addLog(s, 'info', 'Антистресант внесено', 'Ознак стресу не зафіксовано — ефект мінімальний.');
      break;
    }
  }
  evaluateQuest(s, { kind: 'spray', op, pre: p, eff });
}

// ---------------------------------------------------------------------------
// Лабораторні прилади
// ---------------------------------------------------------------------------
export function useTool(s: SimState, tool: ToolId) {
  const r = toolRelevance(s, tool);
  s.diagnostics.push({ day: s.day, tool, relevant: r.relevant });
  addLog(s, 'diag', `Діагностика: ${TOOLS[tool].name}`, r.relevant ? undefined : 'Прилад не дає відповіді на поточну проблему поля.');
  if (s.quest && !s.quest.solved && r.relevant && r.crisis === s.quest.id) s.quest.diagnosed = true;
}
