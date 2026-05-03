#!/usr/bin/env python3
"""Write all scraped recipe data into missing_ingredients_final.csv"""
import csv
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent / "data-exports" / "missing_ingredients_final.csv"

def mins_to_display(mins):
    if mins is None: return ""
    if mins < 60: return f"{mins} min"
    h = mins // 60; m = mins % 60
    return f"{h} hr" if m == 0 else f"{h} hr {m} min"

# All scraped data: row_num -> (ingredients_list, time_mins)
DATA = {
    4: (["1 teaspoon neutral oil for greasing", "1 tablespoon sesame oil", "1/4 cup melted coconut oil or olive oil", "3 tablespoons soy sauce", "1 tablespoon rice vinegar", "1 tablespoon Sriracha optional", "8 pieces bone-in skin-on chicken thighs or drumsticks", "1 pinch kosher salt and pepper to taste", "1 head cabbage 2 to 3 lbs."], 60),
    6: (["4 tablespoons olive oil divided", "1 lb cherry tomatoes", "4 cloves garlic thinly sliced", "1 small shallot optional thinly sliced", "1 to 2 small hot chilies optional", "flaky sea salt", "fresh cracked black pepper", "7 ounce block of feta cut into two slabs", "handful of fresh basil", "bread for serving"], 30),
    7: (["1/3 cup sun-dried tomatoes oil-packed finely diced + 2 tablespoons of the oil", "1 clove garlic finely minced", "kosher salt", "1/4 cup white balsamic vinegar", "1/4 cup extra-virgin olive oil", "two 15-oz cans small white beans drained and rinsed", "2 ears corn shucked", "1 small zucchini finely diced", "1/2 cup finely diced red onion", "3 to 4 scallions thinly sliced", "1 jalapeño seeded and finely diced optional", "fresh basil or parsley finely chopped"], 30),
    15: (["12 ounces flank steak sliced 1/4-inch thick", "1/4 teaspoon baking soda optional", "2 tablespoons water", "1 teaspoon cornstarch", "2 teaspoons neutral oil plus 3 tablespoons divided", "2 teaspoons oyster sauce", "1 cup beef or chicken stock warmed", "1 tablespoon light soy sauce", "1/2 teaspoon dark soy sauce", "1.5 tablespoons oyster sauce", "1/2 teaspoon sesame oil", "1/4 teaspoon sugar", "1 pinch white pepper", "2 tablespoons neutral oil", "1 slice ginger smashed", "2 scallions cut into 2-inch pieces", "2 cloves garlic chopped", "7 ounces fresh shiitake mushrooms sliced", "7 ounces winter bamboo shoots", "1 tablespoon Shaoxing wine", "1 tablespoon cornstarch mixed with 1 tablespoon water"], 40),
    20: (["1.5 pounds boneless skinless chicken thighs cut into 1.5-inch pieces", "2 tablespoons Shaoxing wine divided", "1/2 teaspoon salt", "1/4 teaspoon white pepper", "2 teaspoons light soy sauce plus 1 tablespoon divided", "2 teaspoons neutral oil plus 3 tablespoons divided", "10 dried shiitake mushrooms soaked and rehydrated", "1/2 to 1 pound whole chestnuts", "6-8 cloves garlic", "3 slices ginger", "2-3 scallions cut into 2-inch lengths", "2 star anise pods optional", "1/2 tablespoon dark soy sauce", "1 tablespoon oyster sauce", "1.5 cups water reserved from rehydrating mushrooms"], 155),
    23: (["3 pounds boneless pork shoulder", "1/4 cup granulated white sugar", "2 teaspoons salt", "1/2 teaspoon five spice powder", "1/4 teaspoon white pepper", "1/2 teaspoon sesame oil", "1 tablespoon Shaoxing rice wine", "1 tablespoon soy sauce", "1 tablespoon hoisin sauce", "2 teaspoons molasses", "1/8 teaspoon red food coloring optional", "3 cloves finely minced garlic", "2 tablespoons maltose or honey", "1 tablespoon hot water"], 60),
    24: (["1 yellow onion chopped", "1 pound chicken breasts or thighs cut into chunks", "1 red bell pepper chopped", "2 teaspoons dried oregano", "1/2 teaspoon chipotle chili powder", "salt and black pepper", "1/2 cup dry broken spaghetti or angel hair pasta", "1 cup long grain rice", "1/2 cup chunky red salsa", "2 tablespoons chopped pepperoncini", "1 can 14 ounce black beans drained", "1 cup shredded Swiss cheese", "1/2 cup shredded pepper jack or spicy cheddar", "chopped cilantro", "chopped scallions", "cubed or sliced avocado", "lots of fresh limes"], 45),
    25: (["5 bone in chicken thigh fillets skin off", "1 onion chopped", "2 cloves garlic large minced", "2 tbsp butter or olive oil", "1.5 cups uncooked white rice", "1.5 cups chicken broth hot", "1.25 cups water hot", "1 tsp paprika powder", "1 tsp dried thyme", "1/2 tsp garlic powder", "1/2 tsp onion powder", "3/4 tsp salt", "black pepper", "oil spray", "fresh thyme leaves or finely chopped parsley"], 80),
    27: (["10 garlic cloves peeled", "2 tbsp dried oregano", "1 tsp dried rosemary", "1 tsp sweet paprika", "1 tsp each Kosher salt and black pepper", "1/4 cup Greek extra virgin olive oil", "1/4 cup dry white wine", "juice of 1 lemon", "2 bay leaves", "2.5 lb boneless skinless chicken breast cut into 1.5 inch pieces", "Greek pita bread", "Tzatziki Sauce", "sliced tomato cucumber onions and Kalamata olives"], 25),
    30: (["1 pound ground chicken or ground beef optional", "2 medium sweet potatoes cubed", "1 yellow onion chopped", "3 tablespoons taco seasoning", "1/2 cup salsa or salsa verde", "1 cup canned black beans drained", "2 cups red enchilada sauce", "16 6-inch corn tortillas warmed", "olive oil for coating", "2 cups shredded Mexican cheese blend", "2 avocados chopped or sliced", "1 cup chopped fresh cilantro", "Greek yogurt limes and sea salt for serving"], 60),
    32: (["1.5 pounds ground beef or chicken", "1 yellow onion sliced", "1 tablespoon chili powder", "2 teaspoons garlic powder", "2 teaspoons chipotle chile powder or 2 canned chipotle chiles chopped", "2 teaspoons smoked paprika", "1 teaspoon ground cumin", "1 teaspoon dried oregano", "1 teaspoon salt", "1 can red enchilada sauce", "2 cups shredded Mexican cheese", "16-20 flour tortillas", "olive oil for rubbing", "1 cup plain Greek yogurt or sour cream", "1 cup fresh cilantro", "1 teaspoon garlic powder", "1 teaspoon onion powder", "1 teaspoon dried dill", "1/4 cup lime juice", "1 teaspoon kosher salt"], 45),
    34: (["2 pounds boneless chicken tenders", "2 tablespoons + 3/4 cup brown rice flour", "1 teaspoon garlic powder", "1 teaspoon onion powder", "flaked sea salt and black pepper", "3/4 to 1 cup buttermilk", "1/4 to 1/2 cup finely shredded unsweetened coconut", "1 teaspoon smoked paprika", "1/2 to 1 teaspoon ground turmeric", "2 teaspoons lime zest", "extra virgin olive oil for brushing", "1/2 cup mayo", "1/4 cup buffalo sauce", "1 tablespoon ketchup", "1/2 teaspoon garlic powder"], 30),
    38: (["1 1/2 pounds boneless skinless chicken thighs", "3 tablespoons olive oil", "2 lemons zested and juiced", "6 cloves garlic finely chopped or grated", "1/4 cup finely chopped fresh dill", "2 teaspoons dried oregano", "kosher salt and ground black pepper to season", "for serving: avocado tzatziki herbed lemon rice shredded lettuce diced cucumber cherry tomatoes diced feta pickled red onions fresh dill warm pita bread", "1/2 English cucumber grated and squeezed", "1 large avocado pitted and peeled", "2 cloves garlic", "2 lemons juiced", "1/4 cup finely chopped fresh dill", "1/3 cup full-fat Greek yogurt", "2-3 tablespoons water", "kosher salt and ground black pepper to season"], 45),
    40: (["1.8kg lamb shoulder bone in", "2 tbsp olive oil", "2 tsp salt", "1 tsp black pepper", "1 onion quartered", "1 head garlic cut in half horizontally", "3 garlic cloves cut into slivers", "8 sprigs rosemary", "1 cup water", "2 tbsp flour", "2 cups beef broth or 1 cup red wine + 1 cup water", "salt and pepper"], 225),
    41: (["1 pound large peeled and deveined shrimp", "1/2 cup honey", "1/4 cup soy sauce", "3 cloves minced garlic", "juice of one lemon", "2 tablespoons unsalted butter", "chopped green onions"], 20),
    45: (["4 oz ground pork or chicken or turkey", "2 teaspoons Shaoxing wine or dry sherry", "1 teaspoon light soy sauce", "1/2 teaspoon minced ginger", "1 teaspoon cornstarch optional", "2 teaspoons Sichuan peppercorns", "1 tablespoon peanut oil or vegetable oil", "3 tablespoons Doubanjiang", "2 green onion chopped", "1 block firm or medium firm tofu cut into 1.5cm squares", "1 cup chicken stock or water", "2 teaspoons homemade chili oil", "1/4 teaspoon five-spice powder", "1 teaspoon sugar or to taste"], 25),
    47: (["2 tablespoons olive oil or avocado oil", "8 ounces baby bella or cremini mushrooms finely chopped", "4 teaspoons minced garlic", "1 teaspoon chopped fresh thyme", "1 teaspoon chopped fresh rosemary", "1/4 teaspoon fine sea salt", "1 teaspoon onion powder", "1 teaspoon tamari sauce or soy sauce", "2 cups low-sodium vegetable or chicken broth", "2 tablespoons cornstarch", "12 ounces fresh green beans chopped", "1 cup peeled and chopped carrot", "1 cup frozen corn", "1 can 15-ounce cannellini beans rinsed and drained", "1/2 cup plain Greek yogurt", "1 cup shredded mozzarella cheese divided", "32 whole-wheat crackers crumbled", "1 tablespoon olive oil or avocado oil", "fresh rosemary leaves optional for garnish"], 55),
    48: (["1 cup large brown lentils", "1 1/2 tablespoons olive oil", "2-3 fat shallots thinly sliced or 1 red onion", "4 cloves garlic rough chopped", "2 teaspoons cumin", "1 teaspoon coriander", "1 teaspoon allspice", "1/2 teaspoon cinnamon", "1/2 teaspoon turmeric optional", "1/4 teaspoon ground ginger", "1 1/2 teaspoons kosher salt", "1 teaspoon dried mint or parsley", "lemon zest from one small lemon", "3 cups water", "1 cup brown basmati rice rinsed and drained"], 35),
    50: (["1 pound boneless chicken breasts with or without skin", "1/3 to 1/2 cup water", "1 tablespoon finely chopped fresh thyme", "1 tablespoon finely chopped fresh oregano", "1 tablespoon minced garlic", "3 tablespoons extra virgin olive oil", "3/4 teaspoon salt", "1/4 teaspoon ground black pepper"], None),
    55: (["1.5 pounds boneless skinless chicken breasts or small thighs", "1 yellow onion thinly sliced", "4 cloves garlic chopped", "2 teaspoons ground ginger", "2 teaspoons chili powder", "1 teaspoon chipotle chili powder", "1 teaspoon turmeric", "1 teaspoon cumin", "salt and black pepper", "1 can 14 ounce crushed tomatoes", "1 can 14 ounce coconut milk", "1 cup cubed sweet potatoes", "1 cup fresh cilantro chopped", "2 tablespoons lemon/lime juice", "1/2 cup roasted peanuts chopped", "rice and naan for serving"], 45),
    64: (["2 pounds pork tenderloin 2 tenderloins", "1/2 teaspoon salt or to taste", "1/2 teaspoon pepper or to taste", "1 tablespoon Italian seasoning", "1 teaspoon garlic powder", "1 teaspoon onion powder", "1 tablespoon olive oil", "1 tablespoon butter unsalted", "2 tablespoon parsley fresh chopped"], 36),
    70: (["2 strips thick-cut bacon chopped", "2 shallots chopped", "2 teaspoons Chinese 5 spice optional", "2-3 tablespoons chili paste", "2 tablespoons Thai red curry paste", "8 cups broth", "1 can coconut milk", "1/4 cup tamari or soy sauce", "1/4 cup creamy peanut butter", "1 tablespoon pickled sushi-style ginger chopped", "4 squares ramen noodles", "1 tablespoon toasted sesame oil", "1/3 cup pickled sushi-style ginger", "1 jalapeño thinly sliced", "soft or hard boiled eggs for serving", "toasted nori sheets sesame seeds and scallions for serving", "6 chicken cutlets or tenders", "1 cup Panko", "3 tablespoons sesame seeds", "2 tablespoons olive oil or butter"], 40),
    76: (["1.5 pounds chicken breasts or thighs thinly sliced", "2 tablespoons butter or oil", "2 shallots sliced", "4 cloves garlic chopped", "1 red pepper thinly sliced", "chili flakes", "black pepper", "1 cup peanut sauce", "1 tablespoon honey", "4 ounces vermicelli rice noodles cooked", "1/3 cup peanuts chopped", "1/2 cup Thai Basil cilantro or mint chopped", "fresh squeezed limes for serving", "2 cucumbers thinly sliced", "2 tablespoons ginger juice or rice vinegar", "1 tablespoon chopped sushi style ginger", "1/4 cup chopped green onions"], 30),
}

# Read the CSV
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

updated = 0
for row in rows:
    num = int(row.get("#", 0))
    if num in DATA:
        ingredients_list, time_mins = DATA[num]
        row["ingredients"] = " | ".join(ingredients_list)
        row["time"] = mins_to_display(time_mins)
        updated += 1
        print(f"  Updated #{num}: {row['Recipe Name']}")

print(f"\nUpdated {updated} rows.")

with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

# Summary
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    all_rows = list(csv.DictReader(f))

done = sum(1 for r in all_rows if r.get("ingredients") and r["ingredients"] not in ("NOT_FOUND", "FETCH_ERROR", ""))
print(f"\nFinal: {done}/{len(all_rows)} recipes have ingredients.")
