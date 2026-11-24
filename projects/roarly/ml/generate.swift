// Writes labeled story sentences for Roarly's on-device director classifier, with Apple's
// on-device model (FoundationModels) as the writer. Each sentence mentions a thing in one
// situation; the situation gives the label (play now: yes/no). Output: JSON lines.
// swift ml/generate.swift <out.jsonl> [per-situation count] [en|es|zh]
import Foundation
import FoundationModels

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "data.jsonl"
let per = CommandLine.arguments.count > 2 ? Int(CommandLine.arguments[2])! : 5
let lang = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "en"

struct LangConfig {
    let things: [String]
    let instructions: String
    let situations: [(String, Bool, String)]
    let prompt: (Int, String, String) -> String
    let contains: (String, String) -> Bool
}

func fold(_ s: String) -> String {
    s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
}

let config: LangConfig
switch lang {
case "es":
    config = LangConfig(
        things: ["león", "tigre", "oso", "lobo", "elefante", "mono", "dinosaurio", "dragón", "serpiente", "ballena",
                 "perro", "gato", "vaca", "caballo", "oveja", "búho", "rana", "abeja", "pájaro", "tren",
                 "coche", "barco", "campana", "reloj"],
        instructions: "Escribes oraciones sueltas de cuentos infantiles contados en voz alta por un padre o madre. Español hablado natural, sencillo y variado. Una oración por línea, sin numeración, sin comillas.",
        situations: [
            ("arrives", true, "el/la THING aparece de repente, llega, salta o se acerca ahora mismo"),
            ("acts", true, "el/la THING está haciendo algo activo ahora mismo en la escena (persiguiendo, corriendo hacia alguien, mirando, saltando, despertando)"),
            ("sound", true, "el/la THING hace su sonido ahora mismo (ruge, ladra, ulula, pita, suena, etc.)"),
            ("intro", true, "se presenta al/a la THING como si estuviera allí mismo en la historia (había un THING, aquí viene el THING)"),
            ("question", true, "quien cuenta el cuento le pregunta al niño cómo hace o qué sonido hace el/la THING"),
            ("leaves", false, "el/la THING se va, huye, corre lejos, vuelve a casa o desaparece"),
            ("sleeps", false, "el/la THING está dormido, descansando, callado o en silencio"),
            ("absent", false, "no hay ningún THING, nadie vio un THING, o el THING no está allí (negación)"),
            ("remembers", false, "alguien recuerda, extraña, sueña o imagina al/a la THING; no está en la escena"),
            ("far", false, "el/la THING está muy lejos, al otro lado del mundo, o solo se menciona como un dato"),
        ],
        prompt: { per, thing, desc in
            "Escribe \(per) oraciones diferentes en español donde \(desc.replacingOccurrences(of: "THING", with: thing)). Cada oración debe incluir la palabra \"\(thing)\". Varía la redacción y la longitud."
        },
        contains: { line, thing in fold(line).contains(fold(thing)) && line.count > 8 }
    )
case "zh":
    config = LangConfig(
        things: ["狮子", "老虎", "大熊", "大灰狼", "大象", "猴子", "恐龙", "巨龙", "蛇", "鲸鱼",
                 "小狗", "小猫", "奶牛", "小马", "绵羊", "猫头鹰", "青蛙", "蜜蜂", "小鸟", "火车",
                 "汽车", "轮船", "闹钟", "门铃"],
        instructions: "你写家长给孩子大声讲的儿童故事里的单句。自然、口语化的简体中文。每行一句，不要编号，不要引号。",
        situations: [
            ("arrives", true, "THING突然出现、到来、跳出来或跑过来"),
            ("acts", true, "THING正在场景里活跃地行动（追赶、扑过来、跳起来、醒过来、看着大家）"),
            ("sound", true, "THING正在发出声音（吼叫、汪汪叫、呜呜响、叮咚响等等）"),
            ("intro", true, "介绍THING就在眼前的故事里（前面有一只THING、看，THING来了）"),
            ("question", true, "讲故事的人问孩子THING是怎么叫的或发出什么声音"),
            ("leaves", false, "THING正在离开、逃跑、跑远、回家或消失了"),
            ("sleeps", false, "THING睡着了、在休息、安安静静或没有声音"),
            ("absent", false, "没有THING、谁也没看见THING，或者THING不在这里（否定）"),
            ("remembers", false, "有人想起、想念、梦见或想象THING，它并不在现场"),
            ("far", false, "THING在很远的地方，或者只是顺口提到一个常识"),
        ],
        prompt: { per, thing, desc in
            "用简体中文写\(per)句不同的儿童故事句子，内容是：\(desc.replacingOccurrences(of: "THING", with: thing))。每句必须包含“\(thing)”。句式和长短要有变化。"
        },
        contains: { line, thing in line.contains(thing) && line.count >= 5 }
    )
default:
    config = LangConfig(
        things: ["lion", "tiger", "bear", "wolf", "elephant", "monkey", "dinosaur", "dragon", "snake", "whale",
                 "dog", "puppy", "cat", "kitten", "cow", "horse", "sheep", "owl", "frog", "bee", "bird", "seagull",
                 "train", "car", "boat", "airplane", "rocket", "clock", "bell", "doorbell", "fairy", "wizard"],
        instructions: "You write single sentences from children's stories told out loud by a parent. Plain, varied, natural spoken English. One sentence per line, no numbering, no quotes.",
        situations: [
            ("arrives", true, "the THING suddenly appears, arrives, jumps out or comes closer right now"),
            ("acts", true, "the THING is doing something lively right now in the scene (chasing, running toward someone, looking at someone, jumping, waking up)"),
            ("sound", true, "the THING makes its noise right now (roars, barks, hoots, honks, rings, and so on)"),
            ("intro", true, "the THING is introduced as being right there in the story (there was a THING, here comes the THING)"),
            ("question", true, "the storyteller asks the child what the THING says or what sound it makes"),
            ("leaves", false, "the THING is leaving, running away, going home or disappearing"),
            ("sleeps", false, "the THING is asleep, resting, quiet or silent"),
            ("absent", false, "there is no THING, nobody saw a THING, or the THING is not there (negated)"),
            ("remembers", false, "someone remembers, misses, dreams of or imagines the THING; it is not in the scene"),
            ("far", false, "the THING is far away, on the other side of the world, or only talked about as a fact"),
        ],
        prompt: { per, thing, desc in
            "Write \(per) different sentences where \(desc.replacingOccurrences(of: "THING", with: thing)). Each sentence must contain the word \"\(thing)\". Vary the wording and length."
        },
        contains: { line, thing in line.lowercased().contains(thing) && line.count > 8 }
    )
}

FileManager.default.createFile(atPath: out, contents: nil)
let handle = try FileHandle(forWritingTo: URL(fileURLWithPath: out))
var written = 0
for thing in config.things {
    for (name, play, desc) in config.situations {
        let session = LanguageModelSession(instructions: config.instructions)
        let prompt = config.prompt(per, thing, desc)
        do {
            let r = try await session.respond(to: prompt, options: GenerationOptions(temperature: 0.9, maximumResponseTokens: 350))
            for line in r.content.split(separator: "\n") {
                var s = line.trimmingCharacters(in: .whitespaces)
                while let f = s.first, "-•*0123456789.)、 ".contains(f) { s.removeFirst() }
                s = s.trimmingCharacters(in: CharacterSet(charactersIn: "\"“”«»「」 "))
                guard config.contains(s, thing) else { continue }
                let row: [String: Any] = ["text": s, "thing": thing, "situation": name, "play": play]
                handle.write(try JSONSerialization.data(withJSONObject: row) + Data("\n".utf8))
                written += 1
            }
        } catch {
            print("skip \(thing)/\(name): \(error)")
        }
    }
    print("[\(lang)] \(thing): \(written) so far")
}
print("[\(lang)] done: \(written)")
