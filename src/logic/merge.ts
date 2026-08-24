import { defaultDoc } from './defaults'
import { rollMonth } from './finance'
import { normalize } from './normalize'
import { DOC_VERSION } from '../types'
import type {
  Activity,
  ArchiveRec,
  Book,
  Course,
  CourseSection,
  Doc,
  Finance,
  Habit,
  HistoryRec,
  Idea,
  IdeaCheck,
  IdeaLink,
  LibDone,
  LibNote,
  MandatoryExpense,
  OneTimeExpense,
  Rates,
  Reminder,
  Sector,
  Show,
  Slip,
  Snapshot,
  Snapshots,
  Step,
  TimeEntry,
  Video,
} from '../types'

/**
 * Трёхстороннее слияние документов.
 *
 * Облако хранит один документ целиком, поэтому раньше расхождение решалось
 * выбором стороны: либо принять облако (и потерять свою правку), либо дослать
 * своё (и стереть чужую). Обе беды — одна и та же: выбор вместо объединения.
 *
 * Здесь появляется третий участник — база: тело документа, которое облако
 * содержало на версии, с которой это устройство последний раз согласовано.
 * Зная базу, можно отличить «я это добавил» от «этого ещё не было» и «этого
 * больше нет», а значит объединить обе стороны, а не выбрать одну.
 *
 * Главное требование ко всем правилам — идемпотентность относительно эха.
 * Облако регулярно содержит не чужое состояние, а наше собственное прошлое:
 * keepalive-отправка при закрытии вкладки уходит, не читая ответа, и на
 * следующей загрузке своё же тело выглядит как «чужая правка». Поэтому нигде
 * не складываются дельты: правило `pick3` при совпадении сторон возвращает их
 * значение как есть, а объединение по id не создаёт дубля. Проверяется
 * свойством `merge(base, m, m) === m` в тестах.
 *
 * Известный предел: пределы длины списков (MAX_SECTORS и прочие) применяет
 * normalize уже после слияния. Если список у самого предела и обе стороны
 * добавили по записи, лишняя молча отбрасывается — и отбрасывается та, что
 * пришла из облака. Учить слияние всем пределам и направлениям обрезки значит
 * продублировать их вместе с семантикой «голова или хвост», поэтому пока так;
 * до предела здесь десятки записей, а не единицы.
 */

/* ── сравнение ────────────────────────────────────────────────────────── */

/** Ключи со значением undefined считаются отсутствующими: `pinned`/`nextId` то есть, то нет */
function definedKeys(o: Record<string, unknown>): string[] {
  return Object.keys(o).filter((k) => o[k] !== undefined)
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const aArr = Array.isArray(a)
  if (aArr !== Array.isArray(b)) return false
  if (aArr) {
    const x = a as unknown[]
    const y = b as unknown[]
    return x.length === y.length && x.every((v, i) => deepEqual(v, y[i]))
  }
  const x = a as Record<string, unknown>
  const y = b as Record<string, unknown>
  const kx = definedKeys(x)
  if (kx.length !== definedKeys(y).length) return false
  return kx.every((k) => deepEqual(x[k], y[k]))
}

/**
 * Одинаковы ли документы по существу.
 *
 * Штамп времени в снимке за сегодня не в счёт: он обновляется при любом
 * действии и к содержимому колеса отношения не имеет — сравнивать по нему
 * значило бы считать изменённым документ, в котором ничего не поменяли.
 */
export function sameDoc(a: Doc, b: Doc): boolean {
  const { snapshots: sa, ...ra } = a
  const { snapshots: sb, ...rb } = b
  if (!deepEqual(ra, rb)) return false
  const keys = Object.keys(sa)
  if (keys.length !== Object.keys(sb).length) return false
  return keys.every((k) => !!sb[k] && deepEqual(sa[k]!.sectors, sb[k]!.sectors))
}

/* ── правила для значений ─────────────────────────────────────────────── */

/**
 * Значение изменила одна сторона — берём её. Спорят обе — за локальной: на неё
 * человек смотрит прямо сейчас, а второе устройство при следующей сверке увидит
 * «моё совпадает с базой» и молча примет результат.
 */
function pick3<T>(base: T, local: T, cloud: T): T {
  if (deepEqual(local, base)) return cloud
  if (deepEqual(cloud, base)) return local
  return local
}

/** Монотонные счётчики (рекорд серии, прочитанные страницы) — дальше пройденное */
function max3(_base: number, local: number, cloud: number): number {
  return Math.max(local, cloud)
}

/** Момент времени, где null — «никогда» и меньше любого значения */
function maxIso3(_base: string | null, local: string | null, cloud: string | null): string | null {
  if (local === null) return cloud
  if (cloud === null) return local
  return local >= cloud ? local : cloud
}

/**
 * Множество отметок: то, что было в базе, остаётся, только если уцелело у обеих
 * сторон (снятие отметки — тоже действие), а новое приходит от любой из них.
 */
function set3(base: string[], local: string[], cloud: string[]): string[] {
  const B = new Set(base)
  const L = new Set(local)
  const C = new Set(cloud)
  const keep = (k: string) => (B.has(k) ? L.has(k) && C.has(k) : L.has(k) || C.has(k))
  const out: string[] = []
  for (const k of [...cloud, ...local]) if (keep(k) && !out.includes(k)) out.push(k)
  return out
}

/** Словарь: присутствие ключа как в set3, значение — по правилу */
function mapMerge<T>(
  base: Record<string, T>,
  local: Record<string, T>,
  cloud: Record<string, T>,
  value: (b: T | undefined, l: T, c: T) => T,
): Record<string, T> {
  const out: Record<string, T> = {}
  for (const k of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    if (k === '__proto__') continue
    const l = local[k]
    const c = cloud[k]
    if (k in base && (l === undefined || c === undefined)) continue
    if (l !== undefined && c !== undefined) out[k] = value(base[k], l, c)
    else out[k] = (l ?? c) as T
  }
  return out
}

type Rules<T> = { [K in keyof T]?: (b: T[K], l: T[K], c: T[K]) => T[K] }

/** Объект по полям: каждое поле спорит отдельно, поэтому правки в разные поля складываются */
function mergeFields<T extends object>(base: T, local: T, cloud: T, rules: Rules<T> = {}): T {
  const b = base as Record<string, unknown>
  const l = local as Record<string, unknown>
  const c = cloud as Record<string, unknown>
  const out: Record<string, unknown> = {}
  const byKey = rules as Record<string, ((x: unknown, y: unknown, z: unknown) => unknown) | undefined>
  for (const k of new Set([...definedKeys(l), ...definedKeys(c)])) {
    const rule = byKey[k]
    out[k] = rule ? rule(b[k], l[k], c[k]) : pick3(b[k], l[k], c[k])
  }
  return out as T
}

/* ── списки с id ──────────────────────────────────────────────────────── */

interface Ided {
  id: string
}

/**
 * Удаление сильнее правки: элемент, пропавший у одной стороны, не воскрешается,
 * даже если вторая его правила.
 *
 * Это не косметика. Удаления в приложении почти всегда — половина переноса:
 * archiveSector, finishLibItem, «в книги», «оплачено» удаляют запись и создают
 * новую в другом месте. Воскрешение дало бы книгу одновременно в списке и в
 * «прочитано». А удалённая идея вдобавок уносит свои фото из хранилища —
 * вернуть её значит вернуть битые картинки.
 */
const DELETE_WINS = true

function orderOf(list: Ided[], ids: Set<string>): string[] {
  return list.filter((x) => ids.has(x.id)).map((x) => x.id)
}

/**
 * Пустая заготовка элемента: списки — пустые, словари — пустые, остальное не
 * задано.
 *
 * Нужна там, где один и тот же id есть у обеих сторон, но нет в базе. Так бывает
 * не только при эхе: отправка при закрытии вкладки могла долететь, телефон её
 * забрать и дополнить — тогда в облаке лежит наша запись с чужими правками, а
 * общего предка у нас нет. Подставить облачный элемент как базу означало бы
 * «у облака ничего не менялось» и выбросить всё, что телефон дописал внутрь:
 * этапы, заметки, отметки. С пустой заготовкой вложенные списки объединяются, а
 * спор за одно значение решается общим правилом — за локальной стороной.
 */
function neutralBase<T extends object>(local: T, cloud: T): T {
  const l = local as Record<string, unknown>
  const c = cloud as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of new Set([...definedKeys(l), ...definedKeys(c)])) {
    const v = l[k] !== undefined ? l[k] : c[k]
    out[k] = Array.isArray(v) ? [] : v && typeof v === 'object' ? {} : undefined
  }
  return out as T
}

function mergeById<T extends Ided>(
  base: T[],
  local: T[],
  cloud: T[],
  item?: (b: T, l: T, c: T) => T,
  cmp?: (a: T, b: T) => number,
): { list: T[]; changed: Set<string> } {
  const B = new Map(base.map((x) => [x.id, x]))
  const L = new Map(local.map((x) => [x.id, x]))
  const C = new Map(cloud.map((x) => [x.id, x]))

  // Порядок массива значим только для активностей (горячий ряд и полосы), но
  // правило общее: за основу берётся облако, а если общие элементы переставил
  // только этот экран — его порядок и сохраняем.
  const common = new Set([...L.keys()].filter((id) => C.has(id) && B.has(id)))
  const baseOrder = orderOf(base, common)
  const localMoved = !deepEqual(orderOf(local, common), baseOrder)
  const cloudMoved = !deepEqual(orderOf(cloud, common), baseOrder)
  const spine = localMoved && !cloudMoved ? local : cloud
  const other = spine === local ? cloud : local

  const decide = (id: string): T | null => {
    const b = B.get(id)
    const l = L.get(id)
    const c = C.get(id)
    if (b) {
      if (!l || !c) return DELETE_WINS ? null : ((l ?? c) as T)
      if (deepEqual(l, b)) return c
      if (deepEqual(c, b)) return l
      return item ? item(b, l, c) : l
    }
    // одного id нет в базе, но он есть у обеих сторон: наша отправка долетела и
    // вернулась — возможно, уже с чужими дополнениями. Дубля быть не должно, а
    // содержимое сливается от пустой заготовки (см. neutralBase)
    if (l && c) return item ? item(neutralBase(l, c), l, c) : l
    return l ?? c ?? null
  }

  const out: T[] = []
  const seen = new Set<string>()
  for (const x of spine) {
    if (seen.has(x.id)) continue
    seen.add(x.id)
    const r = decide(x.id)
    if (r) out.push(r)
  }
  // Добавленное второй стороной встаёт следом за своим соседом, а не в конец:
  // так «добавлено в конец списка» выглядит одинаково с обоих устройств.
  let anchor = -1
  for (const x of other) {
    const at = out.findIndex((y) => y.id === x.id)
    if (at >= 0) {
      anchor = at
      continue
    }
    if (seen.has(x.id)) continue
    seen.add(x.id)
    const r = decide(x.id)
    if (!r) continue
    anchor += 1
    out.splice(anchor, 0, r)
  }

  if (cmp) out.sort(cmp)

  const changed = new Set<string>()
  for (const x of out) {
    const b = B.get(x.id)
    if (!b || !deepEqual(b, x)) changed.add(x.id)
  }
  return { list: out, changed }
}

/** Список без id, но с естественным ключом (срывы по дате, заметки по дате и тексту) */
function unionBy<T>(
  base: T[],
  local: T[],
  cloud: T[],
  key: (x: T) => string,
  cmp?: (a: T, b: T) => number,
): T[] {
  const wrap = (xs: T[]) => xs.map((v) => ({ id: key(v), v }))
  const { list } = mergeById(wrap(base), wrap(local), wrap(cloud))
  const out = list.map((x) => x.v)
  if (cmp) out.sort(cmp)
  return out
}

const byDesc = (f: (x: never) => string) => (a: never, b: never) => {
  const x = f(a)
  const y = f(b)
  return x < y ? 1 : x > y ? -1 : 0
}

/* ── отрезки времени ──────────────────────────────────────────────────── */

/**
 * Записи трекера. Инварианты чинятся здесь, а не в normalize: тот при двух
 * идущих записях ставит `end = start` и уничтожает длительность, тогда как
 * правильный конец ранней записи — начало следующей, ровно как поступила бы
 * кнопка на том устройстве, знай она про соседнюю запись.
 */
function mergeEntries(base: TimeEntry[], local: TimeEntry[], cloud: TimeEntry[]): TimeEntry[] {
  const { list, changed } = mergeById(base, local, cloud, (b, l, c) =>
    mergeFields(b, l, c, {
      // обе стороны остановили одну и ту же идущую запись — засчитываем более ранний конец
      end: (be, le, ce) => (be === null && le !== null && ce !== null ? (le <= ce ? le : ce) : pick3(be, le, ce)),
    }),
  )

  // Сортировка ровно как в normalize — по началу и стабильно. Тайбрейк по id
  // выглядел безобиднее, но переставлял бы записи одной минуты и создавал
  // расхождение там, где содержимое совпадает: эхо превращалось бы в правку.
  const out = [...list].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))

  const running = out.filter((e) => e.end === null)
  if (running.length > 1) {
    const keep = running[running.length - 1]!.id
    for (let i = 0; i < out.length; i++) {
      const e = out[i]!
      if (e.end !== null || e.id === keep) continue
      const next = out[i + 1]
      out[i] = { ...e, end: next && next.start > e.start ? next.start : e.start }
      changed.add(e.id)
    }
  }

  // Подрезаются только пересечения, которых раньше не было: давние записи, уже
  // лежавшие внахлёст (ручная правка границ), слияние трогать не должно — иначе
  // оно правило бы их «из ниоткуда» при любой правке соседа.
  const before = new Map(base.map((e) => [e.id, e]))
  for (let i = 0; i < out.length - 1; i++) {
    const cur = out[i]!
    const next = out[i + 1]!
    if (cur.end === null || next.start >= cur.end) continue
    if (next.end !== null && next.end <= next.start) continue
    // одинаковое начало обрезать нечем: получился бы отрезок нулевой длины, то
    // есть потерянный час вместо разрешённого спора — пусть лучше остаётся нахлёст
    if (next.start <= cur.start) continue
    const wasCur = before.get(cur.id)
    const wasNext = before.get(next.id)
    if (wasCur && wasNext && wasCur.end !== null && wasNext.start < wasCur.end) continue
    out[i] = { ...cur, end: next.start }
  }

  return out
}

/* ── сущности ─────────────────────────────────────────────────────────── */

function mergeSector(b: Sector, l: Sector, c: Sector): Sector {
  return mergeFields(b, l, c, {
    steps: (bs, ls, cs) => mergeById<Step>(bs, ls, cs, (x, y, z) => mergeFields(x, y, z)).list,
    history: (bh, lh, ch) =>
      mergeById<HistoryRec>(bh, lh, ch, undefined, byDesc((x: HistoryRec) => x.d) as (a: HistoryRec, b: HistoryRec) => number).list,
  })
}

function mergeHabit(b: Habit, l: Habit, c: Habit): Habit {
  return mergeFields(b, l, c, {
    done: (bd, ld, cd) => set3(bd, ld, cd).sort(),
    record: max3,
    best: max3,
    // момент последнего срыва: сорвались на любом устройстве — счётчик начинается заново
    start: (_bs, ls, cs) => (ls >= cs ? ls : cs),
    slips: (bs, ls, cs) =>
      unionBy<Slip>(bs, ls, cs, (s) => s.d, (x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0)),
    logs: (bl, ll, cl) => mapMerge<number>(bl, ll, cl, (bb, lv, cv) => pick3(bb as number, lv, cv)),
  })
}

function mergeBook(b: Book, l: Book, c: Book): Book {
  return mergeFields(b, l, c, {
    pageCur: max3,
    audioCur: max3,
    notes: (bn, ln, cn) =>
      unionBy<LibNote>(bn, ln, cn, (n) => n.d + ' ' + n.text, byDesc((n: LibNote) => n.d) as (a: LibNote, b: LibNote) => number),
  })
}

function mergeCourse(b: Course, l: Course, c: Course): Course {
  return mergeFields(b, l, c, {
    minute: max3,
    sections: (bs, ls, cs) => mergeById<CourseSection>(bs, ls, cs, (x, y, z) => mergeFields(x, y, z)).list,
    notes: (bn, ln, cn) =>
      unionBy<LibNote>(bn, ln, cn, (n) => n.d + ' ' + n.text, byDesc((n: LibNote) => n.d) as (a: LibNote, b: LibNote) => number),
  })
}

/** Позиция в сериале — там, где просмотрено дальше: сезон, потом серия, потом минута */
function mergeShow(b: Show, l: Show, c: Show): Show {
  const rank = (s: Show) => [s.season, s.episode, s.minute]
  const rl = rank(l)
  const rc = rank(c)
  let ahead = l
  for (let i = 0; i < rl.length; i++) {
    if (rl[i]! === rc[i]!) continue
    ahead = rl[i]! > rc[i]! ? l : c
    break
  }
  return mergeFields(b, l, c, {
    season: () => ahead.season,
    episode: () => ahead.episode,
    minute: () => ahead.minute,
    // список сортируется по этому полю — обновление с любого устройства
    // должно поднять запись наверх, а не проиграть более старому updatedAt
    updatedAt: (_b, lv, cv) => (lv >= cv ? lv : cv),
  })
}

function mergeIdea(b: Idea, l: Idea, c: Idea): Idea {
  return mergeFields(b, l, c, {
    links: (bl, ll, cl) => mergeById<IdeaLink>(bl, ll, cl, (x, y, z) => mergeFields(x, y, z)).list,
    images: set3,
    // без правила pick3 забрал бы весь список с одной стороны и стёр отметки,
    // сделанные на другом устройстве — ровно как steps у секторов
    checklist: (bk, lk, ck) => mergeById<IdeaCheck>(bk, lk, ck, (x, y, z) => mergeFields(x, y, z)).list,
  })
}

/**
 * Финансы. Смена месяца применяется ко всем трём документам до слияния: иначе
 * доход нового месяца приписался бы старому, а `hist` за прошлый месяц
 * записался бы по неполным данным — и это уже не откатить.
 *
 * Деньги сливаются как обычные значения, а не суммой изменений: суммы вводятся
 * абсолютным числом («на руках столько»), и сложение двух правок дало бы баланс,
 * которого никто не вводил. Цена — при одновременной правке с двух устройств
 * побеждает одна; она видна сразу, в отличие от тихо испорченного баланса.
 */
function mergeFinance(base: Finance, local: Finance, cloud: Finance, now: number): Finance {
  const b = rollMonth(base, now)
  const l = rollMonth(local, now)
  const c = rollMonth(cloud, now)
  return {
    goal: pick3(b.goal, l.goal, c.goal),
    got: pick3(b.got, l.got, c.got),
    monthKey: [b.monthKey, l.monthKey, c.monthKey].sort().pop()!,
    // «планка взята» — состоявшийся факт: достаточно, чтобы его знала одна сторона
    hist: mapMerge<boolean>(b.hist, l.hist, c.hist, (_bb, lv, cv) => lv || cv),
    onHand: pick3(b.onHand, l.onHand, c.onHand),
    cushion: pick3(b.cushion, l.cushion, c.cushion),
    nextIncome: pick3(b.nextIncome, l.nextIncome, c.nextIncome),
    mandatory: mergeById<MandatoryExpense>(b.mandatory, l.mandatory, c.mandatory, (x, y, z) => mergeFields(x, y, z))
      .list,
    oneTime: mergeById<OneTimeExpense>(b.oneTime, l.oneTime, c.oneTime, (x, y, z) => mergeFields(x, y, z)).list,
  }
}

/* ── документ целиком ─────────────────────────────────────────────────── */

/**
 * База для случая, когда настоящей базы нет, а объединить всё равно надо:
 * первая отправка на пустое облако столкнулась со вторым устройством. Пустая
 * база означает «ничего не удалялось» — только сложение, и это единственный
 * случай, где так можно: в любом другом она воскресила бы удалённое.
 */
export function emptyBase(now: number): Doc {
  return { ...defaultDoc(now), sectors: [], acts: [], snapshots: {} }
}

export function mergeDoc(base: Doc, local: Doc, cloud: Doc, now: number = Date.now()): Doc {
  // быстрые пути: спорить не о чем, и результат должен быть в точности стороной,
  // иначе слияние породило бы правку и лишнюю отправку
  if (sameDoc(local, base)) return cloud
  if (sameDoc(cloud, base)) return local

  // Литерал, а не спред облака: новое поле в Doc обязано вызвать ошибку
  // компиляции, а не исчезнуть молча при первом же слиянии.
  const merged: Doc = {
    v: DOC_VERSION,
    currency: pick3(base.currency, local.currency, cloud.currency),
    rates: mapMerge<number>(base.rates, local.rates, cloud.rates, (bb, lv, cv) => pick3(bb as number, lv, cv)) as Rates,
    hideWatch: pick3(base.hideWatch, local.hideWatch, cloud.hideWatch),
    sectors: mergeById<Sector>(base.sectors, local.sectors, cloud.sectors, mergeSector).list,
    acts: mergeById<Activity>(base.acts, local.acts, cloud.acts, (x, y, z) => mergeFields(x, y, z)).list,
    entries: mergeEntries(base.entries, local.entries, cloud.entries),
    archive: mergeById<ArchiveRec>(
      base.archive,
      local.archive,
      cloud.archive,
      undefined,
      byDesc((x: ArchiveRec) => x.completedAt) as (a: ArchiveRec, b: ArchiveRec) => number,
    ).list,
    snapshots: mapMerge<Snapshot>(base.snapshots, local.snapshots, cloud.snapshots, (_bb, lv, cv) =>
      lv.d >= cv.d ? lv : cv,
    ) as Snapshots,
    habits: mergeById<Habit>(base.habits, local.habits, cloud.habits, mergeHabit).list,
    reminders: mergeById<Reminder>(base.reminders, local.reminders, cloud.reminders, (x, y, z) =>
      mergeFields(x, y, z, { lastDone: maxIso3 }),
    ).list,
    ideas: mergeById<Idea>(base.ideas, local.ideas, cloud.ideas, mergeIdea).list,
    fin: mergeFinance(base.fin, local.fin, cloud.fin, now),
    lib: {
      books: mergeById<Book>(base.lib.books, local.lib.books, cloud.lib.books, mergeBook).list,
      courses: mergeById<Course>(base.lib.courses, local.lib.courses, cloud.lib.courses, mergeCourse).list,
      videos: mergeById<Video>(base.lib.videos, local.lib.videos, cloud.lib.videos, (x, y, z) =>
        mergeFields(x, y, z),
      ).list,
      shows: mergeById<Show>(base.lib.shows, local.lib.shows, cloud.lib.shows, mergeShow).list,
      done: mergeById<LibDone>(
        base.lib.done,
        local.lib.done,
        cloud.lib.done,
        undefined,
        byDesc((x: LibDone) => x.finishedAt) as (a: LibDone, b: LibDone) => number,
      ).list,
    },
  }

  // Снимок за сегодня здесь намеренно не пересчитывается, хотя он и производная
  // от колеса: слияние приезжает в документ действием, а редьюсер после любого
  // действия сам зовёт withTodaySnapshot с уже слитыми секторами. Сделать это и
  // тут значило бы добавлять снимок документу, у которого его не было, — и
  // результат перестал бы совпадать со стороной там, где спорить не о чем.

  // normalize здесь обязателен и обязан ничего не менять: пределы списков,
  // ограничение закреплённых кнопок и висячие ссылки «дальше →» чинятся им, а
  // результат — неподвижная точка, иначе следующая загрузка «дочинит» документ
  // и создаст правку из ниоткуда. Проверяется свойством в тестах.
  return normalize(merged, now)
}
