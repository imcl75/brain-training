"""Build the word lists the word games use.

Writes js/data/words5.js (Daily Word answers and allowed guesses) and
js/data/beewords.js (Word Hive's list of accepted words).

Needs the `wordfreq` package (pip install wordfreq) and macOS's
/usr/share/dict/words. Run from the repo root:

    python3 tools/build_words.py
"""
import re
import json
from pathlib import Path
from wordfreq import top_n_list, zipf_frequency

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "js" / "data"

# Words never used as answers or accepted (slurs, swearing, crude words).
BLOCK = set("""
arse arses arsed bitch bitches bitchy bollock bollocks boner boob boobs booby
bugger buggers butt butts cock cocks cunt cunts damn damned dick dicks dildo
dyke fag fags faggot fanny feck fuck fucks fucked fucker fucking gook homo
horny jism jizz kike knob knobs negro nigga nigger paki penis piss pissed
porn porno prick pricks pube pubes pussy queer rape raped rapes rapist retard
schlong semen sex sexy shag shags shit shits shitty skank slag slags slut
sluts smut spunk tit tits titty turd turds twat twats wank wanked wanker
wankers whore whores wop crap craps crappy hell bloody poof poofs spic tart
tarts minge nonce nonces chink coon coons gypo pikey wog wogs kraut dago
nazi nazis anal anus orgy orgies erotic vagina vulva scrotum testes
""".split())

# American spellings kept as valid guesses but never used as answers.
AMERICAN = set("""
color colors honor honors favor favors labor labors humor odor odors rumor
rumors armor vapor savor flavor valor tumor center centers theater theaters
meter meters liter liters fiber fibers caliber gray grays plow plows mold
molds tire tires curb curbs ax pajamas cozy jewelry draft check program
catalog dialog analyze realize organize recognize apologize
""".split())

dictionary = set()
for line in open("/usr/share/dict/words"):
    w = line.strip()
    if w.islower() and w.isalpha():
        dictionary.add(w)

# web2 is American: add the British spellings of its words.
for w in list(dictionary):
    if w.endswith("or") and len(w) > 4:
        dictionary.add(w[:-2] + "our")
    if w.endswith("ize"):
        dictionary.add(w[:-3] + "ise")
    if w.endswith("ization"):
        dictionary.add(w[:-7] + "isation")
    if w.endswith("er") and len(w) > 4 and w[-3] not in "aeiou":
        dictionary.add(w[:-2] + "re")
    if w.endswith("og"):
        dictionary.add(w + "ue")
dictionary |= set("""
grey greys jewellery plough ploughs mould moulds tyre tyres kerb kerbs pyjamas
cosy draught cheque programme catalogue dialogue analyse paralyse travelled
travelling cancelled cancelling labelled modelling fuelled marvellous aluminium
manoeuvre aeroplane storey storeys sceptic sceptical defence offence licence
practise mum mums mummy telly biscuit biscuits
""".split())

# First names, unless they are also common ordinary words (mark, rose, bill).
NAMES = {line.strip().lower() for line in open("/usr/share/dict/propernames")}


def is_word(w):
    """True if w is a dictionary word or a regular inflection of one."""
    if w in dictionary:
        return True
    stems = []
    if w.endswith("ies"):
        stems.append(w[:-3] + "y")
    if w.endswith("es"):
        stems.append(w[:-2])
    if w.endswith("s"):
        stems.append(w[:-1])
    if w.endswith("ied"):
        stems.append(w[:-3] + "y")
    if w.endswith("ed"):
        stems += [w[:-2], w[:-1]]
        if len(w) > 4 and w[-3] == w[-4]:
            stems.append(w[:-3])
    if w.endswith("ing"):
        stems += [w[:-3], w[:-3] + "e"]
        if len(w) > 5 and w[-4] == w[-5]:
            stems.append(w[:-4])
    if (w.endswith("er") or w.endswith("est")) and zipf_frequency(w, "en") >= 3:
        base = w[:-2] if w.endswith("er") else w[:-3]
        stems += [base, base + "e"]
        if base.endswith("i"):
            stems.append(base[:-1] + "y")
    return any(s in dictionary for s in stems if len(s) >= 2)


def is_simple_plural(w, pool):
    return (w.endswith("s") and not w.endswith("ss") and
            (w[:-1] in pool or (w.endswith("es") and w[:-2] in pool)))


candidates = [w for w in top_n_list("en", 250000)
              if re.fullmatch(r"[a-z]+", w) and w not in BLOCK
              and not (w in NAMES and zipf_frequency(w, "en") < 3.8)]
valid = {w for w in candidates if is_word(w)}

# Names, brands, slang and words that make a poor daily answer.
NOT_ANSWERS = set("""
abbas allan arent barry basal benny betty billy blair blake blanc bobby booty
booze bosch bowel bowie brett brock buffy burke butch chang cheng chevy chile
ching cisco clark clint clive colin costa covid crore cutie cyrus daddy didnt
dixie dolly donna dover drake emery ethel fetal fetus garth gemma hanna harry
henry hogan homer honda hubby irene japan jenna jenny jerry jihad jimmy julio
junta kappa kelly kerry kinky kitty kraft larry laura levin lewis login lynch
malik mamma maria marco mater matte mayer molly mommy monte moron morse nancy
nicky niger notre pablo paddy paolo patel perry peter porto prima psych ralph
randy reese riley rowan rufus ryder sally sammy satan silva singh sloan smith
sperm stein swiss synod terry thine tibet tommy torah trump twain urine wally
walsh wasnt weber wigan willy yahoo bingo papal renal natal anime manga gamer
idiot lousy obese vomit penal caste
""".split())

# Names, places, foreign and US-only words found by checking the list against
# the macOS British dictionary (see tools/word_exclusions.txt).
EXCLUDED = {l.strip() for l in open(ROOT / "tools" / "word_exclusions.txt")
            if l.strip() and not l.startswith("#")}
valid -= EXCLUDED

# Daily Word: five letters.
five = sorted(w for w in valid if len(w) == 5)
answers5 = [w for w in five
            if zipf_frequency(w, "en") >= 3.3
            and w not in AMERICAN and w not in NOT_ANSWERS
            and not is_simple_plural(w, dictionary)
            and not w.endswith("ed")]
guesses5 = sorted(set(five) | set(w for w in dictionary
                                  if len(w) == 5 and w not in BLOCK))

# Word Hive: four letters or more, common enough to be fair.
bee = sorted(w for w in valid
             if 4 <= len(w) <= 15 and zipf_frequency(w, "en") >= 2.6
             and len(set(w)) <= 7)

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "words5.js").write_text(
    "// Built by tools/build_words.py, do not edit by hand.\n"
    "BT.data.words5 = " + json.dumps({
        "answers": " ".join(answers5),
        "guesses": " ".join(guesses5),
    }) + ";\n")
(OUT / "beewords.js").write_text(
    "// Built by tools/build_words.py, do not edit by hand.\n"
    "BT.data.beewords = " + json.dumps(" ".join(bee)) + ";\n")

print(f"answers5 {len(answers5)}  guesses5 {len(guesses5)}  bee {len(bee)}")
