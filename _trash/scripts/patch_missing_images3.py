#!/usr/bin/env python3
"""
Writes collected og:image URLs to Firestore for the 42 recipes found via Chrome.
Also deletes docs that are confirmed 404 or dead links.
"""
import firebase_admin
from firebase_admin import credentials, firestore as fs_module

if not firebase_admin._apps:
    cred = credentials.Certificate('service-account.json')
    firebase_admin.initialize_app(cred)
db = fs_module.client()

# ── Images found via Chrome ───────────────────────────────────────────────────
images = {
    '1Lqkj42P66K2zy4uMncB': 'https://www.foodandwine.com/thmb/SnMCqeht6-RTq7Zc6MScC0hWJc4=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Mexican-Chicken-Pozole-Verde-FT-RECIPE0822-2000-1453cc93dff84f2e8c4e47a68dfaad48.jpg',
    '2pcbbJ0uf6LO8EBySczS': 'https://images.food52.com/fL4CzzS9FZP2CFSa0XbAW0Ll_oY=/8308304e-3f78-439f-8607-50965208ae65--PastaSmokedSalmon.jpg',
    '3Z7DJda4nxCe5ma88X1q': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2022/11/Parmesan-Herb-Roasted-Acorn-Squash-main.jpg',
    '4TXl1zTCK1uoZv0K0muJ': 'https://www.foodandwine.com/thmb/lW20OTOy-kiB6nEBvmtp9OfSyGU=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/roasted-kabocha-with-maple-syrup-and-ginger-XL-RECIPE1116_0-5fba406021f045949f4a848f4b0fb498.jpg',
    '7rVgYpu2kOuGbA42dNud': 'https://www.foodandwine.com/thmb/jVmJLRAvSLUyXLaq4sU4-kdfPt0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/cacio-e-pepe-white-bean-and-ham-soup-FT-RECIPE0125-a7e4559fee17418cb3db0bf6fc2cc589.jpeg',
    '8FGlsn3MdRmZfrAAGUit': 'https://images.food52.com/0ZF04S9yhVR07ViV7nSPlsGOj3E=/986a9b8b-797a-4ee6-8842-9cfc54c431f8--2022-0302_sponsored_alaska-seafood_final-recipe_halibut_3x2_not-branded_julia-gartland_0927.jpg',
    'DJs6N2XEej50w5386Xdt': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2020/09/Fried-Cabbage-5.jpg',
    'DoPBaWVLaCRjMTdMmWkg': 'https://www.allrecipes.com/thmb/zS40d39HXGIKNbzt_vwX0_W8UAU=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/AR-237983-easy-tamale-casserole-DDMFS-2x1-617040fe7f2a49a5a3ac401f5c36872d.jpg',
    'E8YrN5DhKGErVsEGJnSC': 'https://images.food52.com/-c6frUxmjRwelXxH2GVbqlZ43dQ=/99a892c2-d5e3-4084-82f6-47e314ee9eea--2021-0727_holiday-pot-roast_3x2_linda-xiao_261.jpg',
    'GT3wU6pLdQMqwroZpPjb': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2023/11/Greek-Sheet-Pan-Chicken-main.jpg',
    'GqE4YVFVO5hCFx6OP90Y': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2020/02/Sauteed-Cabbage-main.jpg',
    'IgyvvFa2PVgX0ns8MVma': 'https://www.littlespicejar.com/wp-content/uploads/2016/10/20-Minute-Chicken-Mozzarella-with-Tomato-Sauce.jpg',
    'KZjBmnYM9Cz1qT28TdLb': 'https://wendisaipkitchen.com/wp-content/uploads/2021/03/Spring-Orange-Asparagus-Landscape.jpg',
    'Kl67t6wiC7WLe9vNwsxF': 'https://natashaskitchen.com/wp-content/uploads/2017/08/Grilled-Steak-Kabobs-4.jpg',
    'LF6lhlCp0AaQg4M3Uqz3': 'https://images.food52.com/L50ZhZuI4RY2tJHYUg1VTCJ_hH4=/c72e3c6e-1596-4ef6-b550-b2d443096262--meatbals-with-orzo-2.jpg',
    'OYOqbenpJOc1NYH14Vtz': 'https://natashaskitchen.com/wp-content/uploads/2023/06/Tuscan-Salmon-3.jpg',
    'PCXgPa7NEr852hq1t5uY': 'https://www.healthygffamily.com/wp-content/uploads/2017/09/E195AB45-6DA0-4209-B527-84BA2AD8D56D.jpg',
    'Q2HGGbogWzqeHeo5UNnZ': 'https://natashaskitchen.com/wp-content/uploads/2018/08/Chicken-Stir-Fry-1-1.jpg',
    'Q3hfk7p5OwlNELhsJaq9': 'https://www.foodandwine.com/thmb/BH-Y1ht3Uhxzg8CDEny-UVsYVI0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Sunday-Sauce-FT-RECIPE1124-a2ff924ad0f84b38928d4bab2591f3ff.jpeg',
    'QPqIzaiONvksPSTMIk1Y': 'https://www.healthygffamily.com/wp-content/uploads/2022/11/5670BC5D-04-scaled.jpg',
    'Qa8hb7FZyqJ7JoXFaVOn': 'https://www.foodandwine.com/thmb/yfYSUIlcfbXD-0g_-m8g_utIgww=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Garlic-shrimp-in-tomato-sauce-FT-RECIPE0424-efd976fab22444e69c7f5b469d5aadd3.jpg',
    'SCWsI3k3bfpPelmkILSw': 'https://natashaskitchen.com/wp-content/uploads/2017/01/Salmon-Cakes-Recipe-9.jpg',
    'Si9m2wK5ocp6z9O0n9rF': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2019/05/Vinegar-Coleslaw-No-Mayo-2.jpg',
    'TKa7OZKFaqRU5B3b6g8D': 'https://images.food52.com/FQen2G9ZRmgKlO1LZReeSshwOao=/edead4d7-d658-4509-ab48-1a1acb84269e--2021-0302_costillas-de-puerco-en-chile-verde_3x2_james-ransom-209.jpg',
    'TgLekNvLt3eZrYqxzyMz': 'https://images.food52.com/p76Nxk6crHdQmndCJ7AVV9X0qe0=/bff6f0ab-c87a-4533-b609-33478407c7ce--13CE65E0-4B72-489A-9513-A03D1B384377.jpeg',
    'Wg5KZN33YZZUBeciZpAf': 'https://cafehailee.com/wp-content/uploads/2023/04/spring-chix-soup-2.jpg',
    'XMfsW3d1XRYwowgnaJA7': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2021/08/Mediterranean-Ground-Beef-Stir-Fry-main.jpg',
    'bwbf7zDlAwSWSu55uW3i': 'https://natashaskitchen.com/wp-content/uploads/2013/11/Shrimp-and-Mushrooms-in-a-Garlic-Bisque-Sauce-3.jpg',
    'eY0CtZZ1b4UnJq0eAOTL': 'https://www.foodandwine.com/thmb/QzDXhbrlIAWNF1El34ymqnoiexE=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Garlicky-Broccolini-FT-RECIPE0822-2000-683e3dbbc57d40b98e0505f87ad295df.jpg',
    'fCyCGC9OGNd4Gf7k0TRr': 'https://natashaskitchen.com/wp-content/uploads/2025/07/Sheet-Pan-Chicken-Fajitas-5.jpg',
    'io7qECE9h7nMza2RplbV': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2023/03/Shrimp-Scampi-main.jpg',
    'izzosymR0GA6n3mQZtSI': 'https://www.littlespicejar.com/wp-content/uploads/2016/07/Easy-Greek-Grilled-Chicken-6.jpg',
    'jLEso60hSnvErqJNtDIk': 'https://www.littlespicejar.com/wp-content/uploads/2024/11/Easy-Tandoori-Chicken-9.jpg',
    'lXepLYyL1iTdzNcKG6hs': 'https://natashaskitchen.com/wp-content/uploads/2012/06/Baked-Salmon-3.jpg',
    'oY15UdhxREq1fueophIw': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2019/12/Balsamic-Bacon-Brussels-Sprouts-main.jpg',
    'pgxPfiz0UFCvl0KhwbWP': 'https://www.littlespicejar.com/wp-content/uploads/2023/02/Fiesta-Creamy-Corn-Chicken-6.jpg',
    'qnLa9q2pUsnLZh9MTzW2': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2025/09/Miso-Salmon-main.jpg',
    'rAoYT1vNyH9BcD9DmWZu': 'https://www.foodandwine.com/thmb/ebVtu4ek3AlWe6F19fRHjymzQX8=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/ginger-braised-pork-meatballs-in-coconut-broth-xl-wnbook2014-2000-39bf208a88ac4883942da2f3ce9d06af.jpg',
    'sgi0mYqmUcVtD3EcApM7': 'https://www.foodandwine.com/thmb/nXrhnH_R6hL2TsN796CFNrKKGJs=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/bolla0715-xl-belgian-ale-braised-pot-roast-with-melted-kale-and-onions-2000-4dbcfd8cf543402dbf86a5dc2da8abb5.jpg',
    'ur666KOx1VYTB42WLCjM': 'https://i2.wp.com/www.downshiftology.com/wp-content/uploads/2023/09/Roasted-Sweet-Potatoes-main-1.jpg',
    'x9pNkh13NuO0xREsMDkT': 'https://www.littlespicejar.com/wp-content/uploads/2021/07/Chicken-Paprika-Pasta-4.jpg',
    'xFDgt1IP2UKxfX5T3cpG': 'https://www.allrecipes.com/thmb/I-lfdRYq_vehBNJZYSr0fMWwjVM=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/AR-231287-sausage-potato-kale-soup-DDMFS-2x1-Beauty-25e2d690a591409a898dffd257b9c0f5.jpg',
}

# ── Confirmed dead (404 or bad URL) — delete from Firestore ──────────────────
dead = {
    'GjCGbsbnPgHDu9DmveoG': 'Garlic Butter Shrimp (404)',
    'kYQ3eqPpwZyq3gvmI6zq': 'Tuscan Butter Salmon (404)',
    'Hxlj6ED7IIVw8LDcdp3I': 'Perfectly Grilled Chicken (dead redirect)',
    '98BZYHXEUPVazENIsnTe': 'Thai Roasted Vegetables (broken URL)',
}

# ── Blocked (no image retrieved, leave as-is) ────────────────────────────────
# XCMgqNmqDtZWFwZ72v5B  Slow-Roasted Caponata Fish    (thekitchn blocked)
# lmpjyNAdsr73840aFIk7  Grilled Sweet Potatoes          (simplyrecipes CF)

print('Writing images to Firestore...')
for doc_id, url in images.items():
    db.collection('recipes').document(doc_id).update({'image': url})
    print(f'  ✓ {doc_id[:8]}…')

print(f'\nUpdated {len(images)} recipes with images.')

print('\nDeleting dead recipes...')
for doc_id, reason in dead.items():
    db.collection('recipes').document(doc_id).delete()
    print(f'  ✗ {doc_id[:8]}… — {reason}')

print(f'\nDeleted {len(dead)} dead recipes.')
print('\nDone. 2 recipes still have no image (thekitchn + simplyrecipes blocked).')
