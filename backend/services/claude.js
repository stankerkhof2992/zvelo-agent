require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const isSimulation = !process.env.ANTHROPIC_API_KEY;

let client = null;
if (!isSimulation) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const MODEL = 'claude-sonnet-4-6';

const SIMULATION_NICHES = [
  {
    niche: 'Minimalist Wall Art Printables',
    score: 9.2,
    trend: 'growing',
    competition: 'medium',
    avg_price: 4.99,
    recommended: true,
    why_this_sells: 'Zeer hoge vraag naar woondecoratie, kopers zijn bereid te betalen voor kwaliteitsdesigns, instant download elimineert verzendproblemen. Zoekvolume stijgt 30% YoY.',
    details: { keywords: ['wall art printable', 'minimalist print', 'instant download art'], monthly_searches: 45000 }
  },
  {
    niche: 'Digital Planner Inserts',
    score: 8.7,
    trend: 'growing',
    competition: 'high',
    avg_price: 3.99,
    recommended: false,
    why_this_sells: 'Enorme markt voor productiviteitstools, terugkerende kopers, eenvoudig variaties te maken. Groei door digitale planners op iPad/tablet.',
    details: { keywords: ['planner inserts', 'digital planner', 'printable planner'], monthly_searches: 38000 }
  },
  {
    niche: 'Social Media Templates',
    score: 8.3,
    trend: 'stable',
    competition: 'high',
    avg_price: 6.99,
    recommended: false,
    why_this_sells: 'Ondernemers en influencers hebben continu nieuwe content nodig. Bundels verkopen goed. Hogere prijspunten mogelijk.',
    details: { keywords: ['instagram templates', 'canva templates', 'social media kit'], monthly_searches: 32000 }
  },
  {
    niche: 'Wedding Invitation Suites',
    score: 8.1,
    trend: 'stable',
    competition: 'medium',
    avg_price: 12.99,
    recommended: false,
    why_this_sells: 'Hoge gemiddelde orderwaarde, seizoensgebonden maar consistent. Bruidsparen zoeken actief op Etsy voor betaalbare alternatieven.',
    details: { keywords: ['wedding invitation template', 'printable wedding invite', 'bohemian wedding'], monthly_searches: 28000 }
  },
  {
    niche: 'Budget Tracker Spreadsheets',
    score: 7.9,
    trend: 'growing',
    competition: 'low',
    avg_price: 5.99,
    recommended: false,
    why_this_sells: 'Financieel bewustzijn groeit, weinig concurrentie voor premium designs. Zoekopdrachten stijgen sterk na nieuwjaarsperiode en bij economische onzekerheid.',
    details: { keywords: ['budget tracker printable', 'financial planner', 'expense tracker'], monthly_searches: 22000 }
  }
];

const SIMULATION_CONCEPTS = [
  {
    title: 'Botanical Line Art Print Set of 4 Minimalist',
    description: `Transform your living space with our stunning collection of minimalist botanical line art prints. This instant download set of 4 coordinating prints brings the serene beauty of nature into your home with clean, contemporary design.

Each print in this botanical wall art printable set features hand-drawn style line illustrations of popular houseplants — monstera, eucalyptus, fern, and olive branch — rendered in an elegant minimalist style that complements any interior design aesthetic.

**Perfect for:**
- Living room gallery walls
- Bedroom accent art
- Home office decoration
- Nursery and children's room decor
- Housewarming or wedding gift

**Why this botanical print set sells:**
The timeless appeal of botanical artwork combined with minimalist design creates pieces that never go out of style. Buyers can print at home or at a local print shop, making it both affordable and convenient.

**Included in your instant download:**
- 4 unique botanical designs
- Available in 5×7, 8×10, and A4 sizes
- High-resolution 300 DPI files (JPEG + PDF)
- Print-ready, no bleed required

**How to download:**
After purchase you'll receive an instant download link. Print at home, at Staples, FedEx, or your local print shop.

✦ Instant Download — What's included:
→ 4 botanical line art prints (JPEG + PDF)
→ 3 sizes: 5×7 | 8×10 | A4
→ 300 DPI print-ready files
→ Commercial use NOT included`,
    tags: ['botanical print', 'wall art printable', 'minimalist print', 'instant download art', 'line art print', 'plant wall art', 'gallery wall set', 'home decor printable', 'botanical art', 'modern wall art', 'nature print set', 'printable wall art', 'botanical decor'],
    price: 4.49,
    dalle_prompt: 'Minimalist botanical line art illustration set of 4 prints, monstera leaf, eucalyptus branch, fern frond, olive branch, thin elegant black lines on pure white background, high resolution, clean and modern aesthetic, print-ready design, professional botanical illustration style',
    why_this_sells: 'Botanisch design is tijdloos en combineert met elk interieur. Set van 4 biedt meer waarde voor de koper. Instant download maakt het drempelvrij.'
  },
  {
    title: 'Daily Planner Insert Printable Minimalist A5',
    description: `Maximize your productivity with our beautifully designed minimalist daily planner insert. This printable planner page helps you organize your day with intention and clarity, featuring a clean layout that keeps you focused on what matters most.

Our digital planner insert is designed for the modern professional who values both aesthetics and functionality. The minimalist design eliminates distractions while providing all the structure you need.

**Layout includes:**
- Time-blocked schedule (6am–10pm)
- Top 3 priorities section
- Notes and ideas space
- Habit tracker (5 habits)
- Water intake tracker
- Gratitude prompt
- Evening reflection space

**Compatible with:**
- A5 binders and planners
- Standard 6-ring binders
- GoodNotes and Notability (digital use)
- Hobonichi Cousin (A5 size)

The minimalist planner aesthetic means this design works year-round — no dates pre-printed so you never waste a page.

**Productivity tip:** Use the top 3 priorities section first thing in the morning. Studies show that focusing on your 3 most important tasks leads to 40% higher daily completion rates.

✦ Instant Download — What's included:
→ Daily planner insert (PDF + PNG)
→ A5 size (148 × 210mm)
→ 300 DPI print-ready
→ Works with GoodNotes & Notability`,
    tags: ['daily planner printable', 'planner inserts A5', 'minimalist planner', 'printable planner page', 'productivity planner', 'digital planner insert', 'daily schedule printable', 'planner pages', 'minimalist daily planner', 'time block planner', 'habit tracker printable', 'undated planner', 'planner refill'],
    price: 2.99,
    dalle_prompt: 'Minimalist daily planner page design, clean white background, thin gray lines, modern sans-serif typography, subtle grid layout, A5 format, professional productivity tool design, flat lay product photography style, high resolution print ready',
    why_this_sells: 'Planner inserts zijn een evergreen niche met terugkerende kopers. Minimalist design spreekt brede doelgroep aan. Laag instappunt trekt nieuwe kopers.'
  },
  {
    title: 'Motivational Quote Print Boho Bedroom Wall Art',
    description: `Fill your space with daily inspiration with this beautiful boho motivational quote print. Designed with carefully chosen typography and subtle bohemian elements, this printable wall art adds both beauty and positive energy to any room.

The perfect affirmation for your bedroom, home office, or meditation space. Our motivational quote prints are designed to inspire and uplift, featuring words that resonate with women, entrepreneurs, and anyone on a journey of personal growth.

Featured quote: "She believed she could, so she did"

The design combines modern boho aesthetics with clean typography — warm earth tones, subtle botanical accents, and layered text create a piece that feels both artistic and intentional.

**Perfect as a gift for:**
- Birthdays and celebrations
- Graduation gifts
- Baby shower decor
- Dorm room decoration
- Self-care and wellness spaces

**Design details:**
- Warm beige and terracotta color palette
- Mixed serif and sans-serif typography
- Subtle floral border elements
- Timeless and gender-neutral enough for any space

✦ Instant Download — What's included:
→ 1 motivational quote print (PDF + JPEG)
→ Sizes: 5×7 | 8×10 | 11×14 | A4 | A3
→ 300 DPI print-ready files
→ Instant download after purchase`,
    tags: ['motivational quote print', 'boho wall art', 'inspirational print', 'bedroom wall art', 'quote printable', 'she believed she could', 'boho home decor', 'printable quote art', 'womens quote print', 'positive affirmation print', 'dorm room decor', 'gift for her', 'boho bedroom decor'],
    price: 3.49,
    dalle_prompt: 'Boho motivational quote wall art print, "She believed she could so she did" typography, warm beige and terracotta earth tones, subtle botanical floral border elements, mixed serif and script fonts, bohemian aesthetic, white background, professional print-ready design, high resolution 300 DPI',
    why_this_sells: 'Quote prints zijn consistent bestsellers op Etsy. Boho stijl is trending. Breed cadeaumarkt (verjaardag, afstuderen) geeft extra verkoopvolume.'
  }
];

async function analyzeNiches() {
  if (isSimulation) {
    console.log('[Claude] Simulatiemodus: niche analyse wordt gesimuleerd');
    await new Promise(r => setTimeout(r, 800));
    return SIMULATION_NICHES;
  }

  const prompt = `Je bent een Etsy marktanalyse expert. Analyseer de volgende digitale product niches voor een nieuwe Etsy shop in ${new Date().getFullYear()}.

Niches om te analyseren:
- Minimalist Wall Art Printables
- Digital Planner Inserts
- Social Media Templates
- Wedding Invitation Suites
- Budget Tracker Spreadsheets
- Quote Prints & Typography
- Kids Room Decor Printables
- Resume & CV Templates
- Recipe Cards Printables
- Logo Design Templates

Geef per niche een objectieve analyse gebaseerd op Etsy markttrends.

Geef je antwoord ALLEEN als een geldig JSON array, geen extra tekst:
[
  {
    "niche": "naam van de niche",
    "score": 8.5,
    "trend": "growing",
    "competition": "medium",
    "avg_price": 4.99,
    "recommended": true,
    "why_this_sells": "korte uitleg waarom dit verkoopt",
    "details": {
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "monthly_searches": 45000
    }
  }
]

Trend opties: "growing", "stable", "declining"
Competition opties: "low", "medium", "high"
Sorteer op score (hoog naar laag). Zet recommended op true voor de top 2.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude gaf geen geldig JSON terug voor niche analyse');
  return JSON.parse(jsonMatch[0]);
}

async function generateConcept(niche) {
  if (isSimulation) {
    console.log(`[Claude] Simulatiemodus: concept genereren voor niche "${niche}"`);
    await new Promise(r => setTimeout(r, 600));
    const concept = SIMULATION_CONCEPTS[Math.floor(Math.random() * SIMULATION_CONCEPTS.length)];
    return { ...concept, niche };
  }

  const prompt = `Je bent een Etsy SEO expert en digitale product creator. Genereer een volledig Etsy listing concept voor de niche: "${niche}".

Vereisten:
- Titel: max 60 tekens, primair keyword staat VOORAAN, pakkend voor kopers
- Beschrijving: 300-500 woorden, eerste 160 tekens zijn cruciaal (preview), verwerk 5-8 longtail keywords NATUURLIJK in de tekst, eindig met "✦ Instant Download" sectie
- Tags: PRECIES 13 unieke tags, mix van breed en specifiek, geen herhaling van woorden die al in de titel staan
- Prijs: competitief voor een nieuwe shop (analyseer wat goed verkoopt)
- DALL-E prompt: gedetailleerde prompt voor productafbeelding
- Why this sells: waarom dit product goed verkoopt

Geef je antwoord ALLEEN als geldig JSON, geen extra tekst:
{
  "title": "max 60 tekens SEO titel",
  "description": "volledige beschrijving met instant download sectie aan het einde",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"],
  "price": 4.99,
  "dalle_prompt": "Minimalist [product] design, [stijl], white background, high resolution, print-ready, professional product photography style, suitable for Etsy digital download listing, clean and modern aesthetic",
  "why_this_sells": "uitleg waarom dit product verkoopt"
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude gaf geen geldig JSON terug voor concept');
  const concept = JSON.parse(jsonMatch[0]);

  if (concept.title.length > 60) {
    concept.title = concept.title.substring(0, 60);
  }
  if (!Array.isArray(concept.tags) || concept.tags.length !== 13) {
    throw new Error(`Verwacht 13 tags, kreeg ${concept.tags?.length}`);
  }

  return concept;
}

async function generateWeeklyRecommendations(salesData) {
  if (isSimulation) {
    return {
      top_niche: 'Minimalist Wall Art Printables',
      scale_up: ['Botanische prints', 'Minimalistische posters'],
      stop: ['Budget planners (lage marge)'],
      recommendations: [
        'Focus op seizoensgebonden designs voor de zomer: strand, natuur, pasteltinten',
        'Maak bundels van bestsellers — kopers betalen 40% meer voor sets',
        'Voeg mockup varianten toe aan bestaande listings voor betere conversie'
      ]
    };
  }

  const prompt = `Als Etsy business coach, analyseer deze verkoopdata en geef concrete aanbevelingen:

${JSON.stringify(salesData, null, 2)}

Geef ALLEEN geldig JSON terug:
{
  "top_niche": "beste niche",
  "scale_up": ["product 1", "product 2"],
  "stop": ["product met lage prestaties"],
  "recommendations": ["aanbeveling 1", "aanbeveling 2", "aanbeveling 3"]
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

module.exports = { analyzeNiches, generateConcept, generateWeeklyRecommendations, isSimulation };
