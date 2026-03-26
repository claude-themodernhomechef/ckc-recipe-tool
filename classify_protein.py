#!/usr/bin/env python3
"""
Classifies each recipe in recipes.json with a 'protein' field based on title keywords.
Prints any unclassified recipes for manual review.
"""
import json, re

INPUT = 'recipes.json'

# Priority order: more specific / less ambiguous first
RULES = [
    ('fish',      [r'\bsalmon\b', r'\btuna\b', r'\bcod\b', r'\bhalibut\b', r'\btilapia\b',
                   r'\bmahi\b', r'\btrout\b', r'\bsnapper\b', r'\bswordfish\b', r'\banchovies?\b',
                   r'\bflounder\b', r'\bsole\b', r'\bcatfish\b', r'\bbranzino\b', r'\bsea bass\b',
                   r'\bgrouper\b', r'\bmackerel\b', r'\bherring\b', r'\bperch\b', r'\bbass\b',
                   r'\bfish\b', r'\bfish tacos?\b']),

    ('seafood',   [r'\bshrimp\b', r'\bprawns?\b', r'\blobster\b', r'\bcrab\b', r'\bscallops?\b',
                   r'\bclams?\b', r'\bmussels?\b', r'\boysters?\b', r'\bsquid\b', r'\boctopus\b',
                   r'\bcalamari\b', r'\bseafood\b', r'\bcrawfish\b', r'\bcrayfish\b']),

    ('chicken',   [r'\bchicken\b', r'\bpollo\b', r'\btikka\b', r'\bwings?\b', r'\bdrumsticks?\b',
                   r'\brotisserie\b', r'\bthighs?\b(?!.*beef|.*pork|.*lamb)',
                   r'\bcoq au vin\b']),

    ('lamb',      [r'\blamb\b', r'\bmutton\b', r'\brack of lamb\b']),

    ('pork',      [r'\bpork\b', r'\bbacon\b', r'\bham\b', r'\bprosciutto\b', r'\bsausage\b',
                   r'\bchorizo\b', r'\bcarnitas\b', r'\bpancetta\b', r'\bsalami\b', r'\bpepperoni\b',
                   r'\bbratwurst\b', r'\bkielbasa\b', r'\bpulled pork\b', r'\bpork belly\b',
                   r'\bpork chops?\b', r'\bspam\b', r'\bguanciale\b',
                   r'\bbaby back ribs?\b', r'\bspare ribs?\b', r'\begg rolls?\b']),

    ('meat',      [r'\bbeef\b', r'\bsteak\b', r'\bburgers?\b', r'\bbrisket\b', r'\bcarne asada\b',
                   r'\bmeatballs?\b', r'\bshort ribs?\b', r'\bsirloin\b', r'\bribeye\b',
                   r'\bfilet\b', r'\bflank\b', r'\bskirt steak\b', r'\bpot roast\b', r'\bbolognese\b',
                   r'\bmeatloaf\b', r'\bbirria\b', r'\bbarbacoa\b', r'\bpicadillo\b',
                   r'\bground beef\b', r'\broast beef\b', r'\bcorned beef\b',
                   r'\btacos? de res\b', r'\bveal\b', r'\brib roast\b', r'\bchuck\b',
                   r'\bphilly\b', r'\bcheeseburger\b', r'\bsliders?\b',
                   r'\bturkey\b', r'\bground turkey\b',
                   r'\bgoulash\b', r'\bkeema\b', r'\blarb\b',
                   r'\bhamburger\b', r'\bcheesesteak\b', r'\broast\b']),

    ('tofu',      [r'\btofu\b', r'\btempeh\b']),

    ('pasta',     [r'\bpasta\b', r'\bspaghetti\b', r'\blinguine\b', r'\bfettuccine\b', r'\bpenne\b',
                   r'\brigatoni\b', r'\borzo\b', r'\bgnocchi\b', r'\blasagna\b', r'\bravioli\b',
                   r'\btortellini\b', r'\bmac(aroni)?\b', r'\bpastina\b', r'\bnoodles?\b',
                   r'\bramen\b', r'\budon\b', r'\bsoba\b', r'\bpad thai\b', r'\blo mein\b',
                   r'\bchow mein\b', r'\bpho\b', r'\bfarfalle\b', r'\bcarbonara\b',
                   r'\bamatriciana\b', r'\bcacio e pepe\b', r'\borecchiette\b', r'\bpappardelle\b',
                   r'\btagliatelle\b', r'\bfusilli\b', r'\bziti\b']),

    ('vegetables',[r'\bvegetabl[eo]s?\b', r'\bveggies?\b', r'\bvegan\b', r'\blentils?\b',
                   r'\bchickpeas?\b', r'\beggplant\b', r'\baubergine\b', r'\bzucchini\b',
                   r'\bcauliflower\b', r'\bmushrooms?\b', r'\bspinach\b', r'\bkale\b',
                   r'\bpumpkin\b', r'\bsquash\b', r'\bbutternut\b', r'\bbean soup\b',
                   r'\blentil soup\b', r'\btomato soup\b', r'\bgazpacho\b', r'\bratatouille\b',
                   r'\bfalafels?\b', r'\bhummus\b', r'\btabbouleh\b', r'\bcaprese\b',
                   r'\bpaneer\b', r'\bchana\b', r'\brajma\b', r'\bdal\b', r'\baloo\b',
                   r'\bbhindi\b', r'\bpav bhaji\b', r'\bmujadara\b', r'\bminestrone\b',
                   r'\bmethi\b', r'\bblack bean\b', r'\bwhite bean\b', r'\bbean tacos?\b',
                   r'\bjackfruit\b', r'\bshakshuka\b', r'\bfeta\b', r'\bcouscous\b',
                   r'\bsouth indian\b', r'\bsweet potato enchiladas?\b']),
]

def classify(name):
    t = name.lower()
    for protein, patterns in RULES:
        for pat in patterns:
            if re.search(pat, t):
                return protein
    return None

with open(INPUT, encoding='utf-8') as f:
    recipes = json.load(f)

unclassified = []
counts = {}

for r in recipes:
    p = classify(r['name'])
    r['protein'] = p
    if p:
        counts[p] = counts.get(p, 0) + 1
    else:
        unclassified.append(r['name'])

with open(INPUT, 'w', encoding='utf-8') as f:
    json.dump(recipes, f, indent=2, ensure_ascii=False)

print(f"✓ Classified {len(recipes) - len(unclassified)}/{len(recipes)} recipes\n")
print("Breakdown:")
for protein, n in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {protein:<12} {n}")

if unclassified:
    print(f"\n⚠ Unclassified ({len(unclassified)}) — review manually:")
    for name in unclassified:
        print(f"  · {name}")
