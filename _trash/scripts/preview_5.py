import json, re, os, anthropic

api_key = os.environ.get('ANTHROPIC_API_KEY', '')
if not api_key:
    env_text = open('functions/.env').read()
    m = re.search(r'ANTHROPIC_API_KEY=(.+)', env_text)
    if m: api_key = m.group(1).strip()

DIET_RULES = open('CKC_Diet_Compliance_Rules.md').read()
CHEF_GUIDE = open('CKC_Chef_Notes_Guide.md').read()
client = anthropic.Anthropic(api_key=api_key)

JSON_SCHEMA = '{"chefNotes":"","dietTags":{"GF":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"DF":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"V":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"Vg":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"K":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"AIP":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"LF":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""},"LH":{"native":false,"mod":false,"notes":"","uncertain":false,"reason":""}}}'

COMBINED_SYSTEM = f"""You are a culinary expert and dietary compliance analyst for a recipe app.

<CHEF_GUIDE>
{CHEF_GUIDE}
</CHEF_GUIDE>

<COMPLIANCE_RULES>
{DIET_RULES}
</COMPLIANCE_RULES>

For a given recipe return a single JSON object with:
1. chefNotes — practical cooking tips following the Chef Guide. Single paragraph, tips separated by " | ". No bullet points, no headers, no diet protocol names.
2. dietTags — analyze all 8 protocols (GF, DF, V, Vg, K, AIP, LF, LH) using only the ingredients list:
   - native: true if compliant AS-IS
   - mod: true if compliant with simple targeted swaps (only if native=false)
   - notes: specific swap instructions (only if mod=true)
   - uncertain: true if less than 100% confident
   - reason: explain uncertainty (only if uncertain=true)
   Rules: native=true means mod=false and notes="". Be conservative. AIP: 4+ core removals = mod=false. LF: garlic-infused oil compliant, plain garlic not.

Reply ONLY with valid JSON matching this structure:
{JSON_SCHEMA}"""

recipes = [
    {'name': 'Baked Ziti', 'cuisine': 'Italian', 'course': 'Entree', 'ingredients': ['1 pound uncooked ziti', '1 package pancetta', '1 pound ground Italian sausage', '1 small white onion diced', '5 cloves garlic minced', '2 jars marinara sauce', '2 handfuls fresh baby spinach', '16 oz shredded whole milk mozzarella', '2/3 cup freshly-grated Parmesan', 'fresh basil and parsley']},
    {'name': 'Beef and Cabbage Stir Fry', 'cuisine': 'Asian', 'course': 'Entree', 'ingredients': ['3 tbsp low sodium soy sauce', '1/4 cup beef broth', '1 tbsp oyster sauce', '1 tbsp hoisin sauce', '1 tsp sesame oil', '1 tsp cornstarch', '1 pound lean ground beef', '2 tsp fresh ginger', '3 cloves garlic', '6 cups napa cabbage', '1.5 cups shredded carrot', 'rice for serving', 'scallion greens']},
    {'name': 'Roasted Maple Ginger Kabocha Squash', 'cuisine': 'Asian', 'course': 'Side', 'ingredients': ['3 pounds kabocha squash peeled and cut into wedges', '3 tbsp pure maple syrup', '3 tbsp extra-virgin olive oil', '1 tbsp finely grated fresh ginger', '6 thyme sprigs', 'kosher salt']},
    {'name': 'Bacon-Wrapped Air Fryer Chicken Breast', 'cuisine': 'American', 'course': 'Entree', 'ingredients': ['4 skinless boneless chicken breasts 8oz each', '8 slices center cut bacon', '1/2 tsp kosher salt', 'freshly ground black pepper']},
    {'name': 'Chicken Cabbage Stir Fry', 'cuisine': 'Asian', 'course': 'Entree', 'ingredients': ['1/4 cup low-sodium soy sauce', '2 tbsp maple syrup', '2 tbsp Shaoxing wine', '2 tsp toasted sesame oil', '1-2 tsp sriracha optional', '2 tsp cornstarch', '2 tbsp avocado oil', '1 pound ground chicken', 'salt and pepper', '1 medium green cabbage 5 cups chopped', '1 large shallot diced', '2 tbsp garlic cloves chopped', '1 tbsp ginger grated', '6 green onions sliced']},
]

for r in recipes:
    ing_str = '\n'.join(r['ingredients'])
    resp = client.messages.create(
        model='claude-sonnet-4-6',
        max_tokens=2000,
        system=[{'type': 'text', 'text': COMBINED_SYSTEM, 'cache_control': {'type': 'ephemeral'}}],
        messages=[{'role': 'user', 'content': f"Recipe: {r['name']}\nCuisine: {r['cuisine']}\nCourse: {r['course']}\nIngredients:\n{ing_str}"}],
    )
    text = resp.content[0].text.strip()
    text = re.sub(r'^```json\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    result = json.loads(text)

    print(f"=== {r['name']} ===")
    print(f"CHEF NOTES:\n{result['chefNotes']}")
    print()
    print("DIET TAGS:")
    for proto, tag in result['dietTags'].items():
        if tag.get('native') or tag.get('mod'):
            label = 'native' if tag['native'] else 'mod'
            notes = f"\n    → {tag['notes']}" if tag.get('notes') else ''
            uncertain = ' ⚠' if tag.get('uncertain') else ''
            print(f"  {proto}: {label}{uncertain}{notes}")
    print()
