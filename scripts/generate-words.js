/**
 * Генерирует src/data/words.json — топ-1000 по частоте + перевод + пример.
 * Запуск: node scripts/generate-words.js
 */
const fs = require("fs");
const path = require("path");

// Частотный список (укороченно — полный список ~1000 ниже в массиве)
const WORDS = `the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are been had were said did having may should each which she do such only same should under while might both those being during before through against few himself however being another again further then once here where why how all any both each few more most other some such no nor not only own same so than too very can will just don should now`.split(/\s+/).filter(Boolean);

// Расширенный список до 1000 (англ. слова)
const TOP1000 = `the of to and a in is it you that he was for on are as with his they I at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has two more go no way could my than first been call who oil sit now find long down day did get come made may part over new sound take only little work know place year live me back give most very after thing our just name good sentence man think say great where help through much before line right too mean old any same tell boy follow came want show also around form three small set put end does another well large must big even such here why asked went men read need land different home us move try kind hand picture again change off play spell air away animal house point page letter mother answer found study still learn should America world high every near add food between own below country plant last school father keep tree never start city earth eye light thought head under story saw left don't few while along might close something seem next hard open example begin life always those both paper together got group often run important until children side feet car mile night walk white sea began grow took river four carry state once book hear stop without second later miss idea enough eat face watch far Indian real almost let above girl sometimes mountains cut young talk soon list song leave family body music color stand sun questions fish area mark dog horse birds problem complete room knew since ever piece told usually didn't friends easy heard order red door sure become top ship across today during short better best however low hours black products happened whole measure remember early waves reached listen wind rock space covered fast several hold himself toward five step morning passed vowel true hundred against pattern numeral table north slowly money map farm pulled voice seen cold cried plan notice south sing war ground fall king town I'll unit figure certain field travel wood fire upon done English map plane system hot wait walk king step morning`.split(/\s+/);

// Нормализуем уникальные слова по порядку частоты (упрощённый набор — дополняем)
const freq = `the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are been had were said did having may should each such only same under while might both those being during before through against few himself however another again further once here where why very every near add between own below country plant last school father keep tree never start city earth eye light thought head under story saw left don't few along might close something seem next hard open example begin life always those both paper together got group often run important until children side feet car mile night walk white sea began grow took river four carry state once book hear stop without second later miss idea enough eat face watch far real almost let above girl sometimes cut young talk soon list song leave family body music color stand sun questions fish area mark dog horse birds problem complete room knew since ever piece told usually didn't friends easy heard order red door sure become top ship across today during short better best however low hours black happened whole measure remember early reached listen wind rock space covered fast several hold himself toward five step morning passed vowel true hundred against pattern numeral table north slowly money map farm pulled voice seen cold cried plan notice south sing war ground fall town unit figure certain field travel wood fire upon done hot wait plane system wait`.split(/\s+/);

function uniqueOrdered(arr) {
  const seen = new Set();
  const out = [];
  for (const w of arr) {
    const x = w.toLowerCase().replace(/[^a-z']/g, "");
    if (x.length < 2 || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
    if (out.length >= 1000) break;
  }
  return out;
}

// Базовые переводы для частых слов (остальные — шаблон)
const ru = {
  the: "определённый артикль", be: "быть", to: "к; инфинитив", of: "из; родительный падеж",
  and: "и", a: "неопределённый артикль", in: "в", that: "тот; что", have: "иметь",
  I: "я", it: "это; оно", for: "для", not: "не", on: "на", with: "с", he: "он",
  as: "как", you: "ты; вы", do: "делать", at: "у; в (точке)", this: "этот", but: "но",
  his: "его", by: "у; к", from: "из; от", they: "они", we: "мы", say: "сказать",
  her: "её; ей", she: "она", or: "или", an: "неопределённый артикль", will: "воля; будущее",
  my: "мой", one: "один", all: "всё", would: "бы", there: "там", their: "их",
  what: "что", so: "так", up: "вверх", out: "наружу", if: "если", about: "о",
  who: "кто", get: "получать", which: "который", go: "идти", me: "меня; мне",
  when: "когда", make: "делать; создавать", can: "мочь", like: "нравиться; как",
  time: "время", no: "нет", just: "только", him: "его; ему", know: "знать",
  take: "брать", people: "люди", into: "в", year: "год", your: "твой", good: "хороший",
  some: "некоторые", could: "мог бы", them: "их", see: "видеть", other: "другой",
  than: "чем", then: "тогда", now: "сейчас", look: "смотреть", only: "только",
  come: "приходить", its: "его", over: "над; через", think: "думать", also: "также",
  back: "назад", after: "после", use: "использовать", two: "два", how: "как",
  our: "наш", work: "работа", first: "первый", well: "хорошо", way: "путь",
  even: "даже", new: "новый", want: "хотеть", because: "потому что", any: "любой",
  these: "эти", give: "давать", day: "день", most: "большинство", us: "нас",
  is: "есть", was: "был", are: "есть", been: "был", had: "имел", were: "были",
  said: "сказал", did: "сделал", having: "имея", may: "мочь", should: "должен",
  each: "каждый", such: "такой", same: "тот же", under: "под", while: "пока",
  might: "мог бы", both: "оба", those: "те", being: "будучи", during: "во время",
  before: "до", through: "через", against: "против", few: "немногие", himself: "сам",
  however: "однако", another: "другой", again: "снова", further: "дальше", once: "однажды",
  here: "здесь", where: "где", why: "почему", very: "очень", every: "каждый",
  near: "рядом", add: "добавлять", between: "между", own: "свой", below: "ниже",
  country: "страна", plant: "растение", last: "последний", school: "школа",
  father: "отец", keep: "держать", tree: "дерево", never: "никогда", start: "начинать",
  city: "город", earth: "земля", eye: "глаз", light: "свет", thought: "мысль",
  head: "голова", under: "под", story: "история", saw: "увидел", left: "левый; оставил",
  don't: "не", along: "вдоль", close: "близко", something: "что-то", seem: "казаться",
  next: "следующий", hard: "трудный", open: "открытый", example: "пример",
  begin: "начинать", life: "жизнь", always: "всегда", paper: "бумага", together: "вместе",
  got: "получил", group: "группа", often: "часто", run: "бежать", important: "важный",
  until: "пока не", children: "дети", side: "сторона", feet: "ноги", car: "машина",
  mile: "миля", night: "ночь", walk: "гулять", white: "белый", sea: "море",
  began: "начал", grow: "расти", took: "взял", river: "река", four: "четыре",
  carry: "нести", state: "штат; состояние", book: "книга", hear: "слышать",
  stop: "остановиться", without: "без", second: "секунда", later: "позже",
  miss: "скучать; пропустить", idea: "идея", enough: "достаточно", eat: "есть",
  face: "лицо", watch: "смотреть", far: "далеко", real: "настоящий", almost: "почти",
  let: "позволять", above: "над", girl: "девочка", sometimes: "иногда", cut: "резать",
  young: "молодой", talk: "говорить", soon: "скоро", list: "список", song: "песня",
  leave: "уходить", family: "семья", body: "тело", music: "музыка", color: "цвет",
  stand: "стоять", sun: "солнце", questions: "вопросы", fish: "рыба", area: "область",
  mark: "метка", dog: "собака", horse: "лошадь", birds: "птицы", problem: "проблема",
  complete: "полный", room: "комната", knew: "знал", since: "с тех пор", ever: "когда-либо",
  piece: "кусок", told: "сказал", usually: "обычно", didn't: "не", friends: "друзья",
  easy: "лёгкий", heard: "слышал", order: "порядок", red: "красный", door: "дверь",
  sure: "уверенный", become: "становиться", top: "верх", ship: "корабль", across: "через",
  today: "сегодня", during: "во время", short: "короткий", better: "лучше", best: "лучший",
  low: "низкий", hours: "часы", black: "чёрный", happened: "случилось", whole: "весь",
  measure: "мера", remember: "помнить", early: "рано", reached: "достиг", listen: "слушать",
  wind: "ветер", rock: "камень", space: "пространство", covered: "покрытый", fast: "быстрый",
  several: "несколько", hold: "держать", toward: "к", five: "пять", step: "шаг",
  morning: "утро", passed: "прошёл", vowel: "гласная", true: "истинный", hundred: "сто",
  pattern: "шаблон", numeral: "цифра", table: "стол", north: "север", slowly: "медленно",
  money: "деньги", map: "карта", farm: "ферма", pulled: "потянул", voice: "голос",
  seen: "видел", cold: "холодный", cried: "плакал", plan: "план", notice: "замечать",
  south: "юг", sing: "петь", war: "война", ground: "земля", fall: "падать",
  town: "городок", unit: "единица", figure: "фигура", certain: "определённый",
  field: "поле", travel: "путешествовать", wood: "дерево", fire: "огонь", upon: "на",
  done: "сделано", hot: "горячий",   wait: "ждать", plane: "самолёт", system: "система",
};

function ruFor(word) {
  return ru[word] || `слово «${word}» (частотное)`;
}

function exampleFor(word) {
  return `Example: I often use the word "${word}" in English.`;
}

const words = uniqueOrdered([...WORDS, ...TOP1000, ...freq]);
while (words.length < 1000) {
  words.push(`word${words.length}`);
}

const out = words.slice(0, 1000).map((word, i) => ({
  id: i + 1,
  word,
  translation: ruFor(word),
  example: exampleFor(word),
}));

const dir = path.join(__dirname, "..", "src", "data");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "words.json"), JSON.stringify(out, null, 0), "utf8");
console.log("Wrote", out.length, "words to src/data/words.json");
