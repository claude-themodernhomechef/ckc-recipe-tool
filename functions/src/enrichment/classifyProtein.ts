/**
 * Protein classifier — TypeScript port of classify_protein.py
 * Priority order: more specific / less ambiguous first.
 */

// Each rule: [proteinLabel, regexPatterns]
const RULES: [string, RegExp[]][] = [
  ['Fish', [
    /\bsalmon\b/, /\btuna\b/, /\bcod\b/, /\bhalibut\b/, /\btilapia\b/,
    /\bmahi\b/, /\btrout\b/, /\bsnapper\b/, /\bswordfish\b/, /\banchovies?\b/,
    /\bflounder\b/, /\bsole\b/, /\bcatfish\b/, /\bbranzino\b/, /\bsea bass\b/,
    /\bgrouper\b/, /\bmackerel\b/, /\bherring\b/, /\bperch\b/, /\bbass\b/,
    /\bfish\b/, /\bfish tacos?\b/,
  ]],

  ['Seafood', [
    /\bshrimp\b/, /\bprawns?\b/, /\blobster\b/, /\bcrab\b/, /\bscallops?\b/,
    /\bclams?\b/, /\bmussels?\b/, /\boysters?\b/, /\bsquid\b/, /\boctopus\b/,
    /\bcalamari\b/, /\bseafood\b/, /\bcrawfish\b/, /\bcrayfish\b/,
  ]],

  ['Chicken', [
    /\bchicken\b/, /\bpollo\b/, /\btikka\b/, /\bwings?\b/, /\bdrumsticks?\b/,
    /\brotisserie\b/, /\bthighs?(?!.*beef|.*pork|.*lamb)\b/, /\bcoq au vin\b/,
  ]],

  ['Lamb', [
    /\blamb\b/, /\bmutton\b/, /\brack of lamb\b/,
  ]],

  ['Pork', [
    /\bpork\b/, /\bbacon\b/, /\bham\b/, /\bprosciutto\b/, /\bsausage\b/,
    /\bchorizo\b/, /\bcarnitas\b/, /\bpancetta\b/, /\bsalami\b/, /\bpepperoni\b/,
    /\bbratwurst\b/, /\bkielbasa\b/, /\bpulled pork\b/, /\bpork belly\b/,
    /\bpork chops?\b/, /\bspam\b/, /\bguanciale\b/,
    /\bbaby back ribs?\b/, /\bspare ribs?\b/, /\begg rolls?\b/,
  ]],

  ['Beef', [
    /\bbeef\b/, /\bsteak\b/, /\bburgers?\b/, /\bbrisket\b/, /\bcarne asada\b/,
    /\bmeatballs?\b/, /\bshort ribs?\b/, /\bsirloin\b/, /\bribeye\b/,
    /\bfilet\b/, /\bflank\b/, /\bskirt steak\b/, /\bpot roast\b/, /\bbolognese\b/,
    /\bmeatloaf\b/, /\bbirria\b/, /\bbarbacoa\b/, /\bpicadillo\b/,
    /\bground beef\b/, /\broast beef\b/, /\bcorned beef\b/,
    /\btacos? de res\b/, /\bveal\b/, /\brib roast\b/, /\bchuck\b/,
    /\bphilly\b/, /\bcheeseburger\b/, /\bsliders?\b/,
    /\bturkey\b/, /\bground turkey\b/,
    /\bgoulash\b/, /\bkeema\b/, /\blarb\b/,
    /\bhamburger\b/, /\bcheesesteak\b/, /\broast\b/,
  ]],

  ['Tofu', [
    /\btofu\b/, /\btempeh\b/,
  ]],

  ['Pasta', [
    /\bpasta\b/, /\bspaghetti\b/, /\blinguine\b/, /\bfettuccine\b/, /\bpenne\b/,
    /\brigatoni\b/, /\borzo\b/, /\bgnocchi\b/, /\blasagna\b/, /\bravioli\b/,
    /\btortellini\b/, /\bmac(aroni)?\b/, /\bpastina\b/, /\bnoodles?\b/,
    /\bramen\b/, /\budon\b/, /\bsoba\b/, /\bpad thai\b/, /\blo mein\b/,
    /\bchow mein\b/, /\bpho\b/, /\bfarfalle\b/, /\bcarbonara\b/,
    /\bamatriciana\b/, /\bcacio e pepe\b/, /\borecchiette\b/, /\bpappardelle\b/,
    /\btagliatelle\b/, /\bfusilli\b/, /\bziti\b/,
  ]],

  ['Vegetarian', [
    /\bvegetabl[eo]s?\b/, /\bveggies?\b/, /\bvegan\b/, /\blentils?\b/,
    /\bchickpeas?\b/, /\beggplant\b/, /\baubergine\b/, /\bzucchini\b/,
    /\bcauliflower\b/, /\bmushrooms?\b/, /\bspinach\b/, /\bkale\b/,
    /\bpumpkin\b/, /\bsquash\b/, /\bbutternut\b/, /\bbean soup\b/,
    /\blentil soup\b/, /\btomato soup\b/, /\bgazpacho\b/, /\bratatouille\b/,
    /\bfalafels?\b/, /\bhummus\b/, /\btabbouleh\b/, /\bcaprese\b/,
    /\bpaneer\b/, /\bchana\b/, /\brajma\b/, /\bdal\b/, /\baloo\b/,
    /\bbhindi\b/, /\bpav bhaji\b/, /\bmujadara\b/, /\bminestrone\b/,
    /\bmethi\b/, /\bblack bean\b/, /\bwhite bean\b/, /\bbean tacos?\b/,
    /\bjackfruit\b/, /\bshakshuka\b/, /\bfeta\b/, /\bcouscous\b/,
    /\bsouth indian\b/, /\bsweet potato enchiladas?\b/,
  ]],
];

/**
 * Classify a recipe's protein type from its title.
 * Returns one of the protein labels above, or null if unclassified.
 */
export function classifyProtein(recipeTitle: string): string | null {
  const lower = recipeTitle.toLowerCase();
  for (const [label, patterns] of RULES) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) return label;
    }
  }
  return null;
}
