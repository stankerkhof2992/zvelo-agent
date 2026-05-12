require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

// Dynamisch: lees de key bij elke aanroep zodat settings-pagina wijzigingen direct werken
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

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

✦ Instant Download — What's included:
→ 4 botanical line art prints (JPEG + PDF)
→ 3 sizes: 5×7 | 8×10 | A4
→ 300 DPI print-ready files`,
    tags: ['botanical print', 'wall art printable', 'minimalist print', 'instant download art', 'line art print', 'plant wall art', 'gallery wall set', 'home decor printable', 'botanical art', 'modern wall art', 'nature print set', 'printable wall art', 'botanical decor'],
    price: 4.49,
    dalle_prompt: 'Minimalist botanical line art illustration, monstera leaf, eucalyptus branch, thin elegant black lines on white background, high resolution, clean modern aesthetic, print-ready',
    why_this_sells: 'Botanisch design is tijdloos en combineert met elk interieur. Set van 4 biedt meer waarde. Instant download maakt het drempelvrij.'
  },
  {
    title: 'Daily Planner Insert Printable Minimalist A5',
    description: `Maximize your productivity with our beautifully designed minimalist daily planner insert. This printable planner page helps you organize your day with intention and clarity.

**Layout includes:**
- Time-blocked schedule (6am–10pm)
- Top 3 priorities section
- Notes and ideas space
- Habit tracker (5 habits)
- Evening reflection space

✦ Instant Download — What's included:
→ Daily planner insert (PDF + PNG)
→ A5 size (148 × 210mm)
→ 300 DPI print-ready`,
    tags: ['daily planner printable', 'planner inserts A5', 'minimalist planner', 'printable planner page', 'productivity planner', 'digital planner insert', 'daily schedule printable', 'planner pages', 'minimalist daily planner', 'time block planner', 'habit tracker printable', 'undated planner', 'planner refill'],
    price: 2.99,
    dalle_prompt: 'Minimalist daily planner page design, clean white background, thin gray lines, modern sans-serif typography, A5 format, professional productivity tool design, high resolution print ready',
    why_this_sells: 'Planner inserts zijn een evergreen niche met terugkerende kopers. Minimalist design spreekt brede doelgroep aan.'
  },
  {
    title: 'Motivational Quote Print Boho Bedroom Wall Art',
    description: `Fill your space with daily inspiration with this beautiful boho motivational quote print. Designed with carefully chosen typography and subtle bohemian elements.

Featured quote: "She believed she could, so she did"

**Perfect as a gift for:**
- Birthdays and celebrations
- Graduation gifts
- Dorm room decoration

✦ Instant Download — What's included:
→ 1 motivational quote print (PDF + JPEG)
→ Sizes: 5×7 | 8×10 | 11×14 | A4 | A3
→ 300 DPI print-ready files`,
    tags: ['motivational quote print', 'boho wall art', 'inspirational print', 'bedroom wall art', 'quote printable', 'she believed she could', 'boho home decor', 'printable quote art', 'womens quote print', 'positive affirmation print', 'dorm room decor', 'gift for her', 'boho bedroom decor'],
    price: 3.49,
    dalle_prompt: 'Boho motivational quote wall art print, warm beige and terracotta earth tones, subtle botanical floral border, mixed serif and script fonts, bohemian aesthetic, white background, professional print-ready design',
    why_this_sells: 'Quote prints zijn consistent bestsellers op Etsy. Boho stijl is trending. Breed cadeaumarkt geeft extra verkoopvolume.'
  }
];

async function analyzeNiches() {
  const client = getClient();
  if (!client) {
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
  const client = getClient();
  if (!client) {
    console.log(`[Claude] Simulatiemodus: concept genereren voor niche "${niche}"`);
    await new Promise(r => setTimeout(r, 600));
    const concept = SIMULATION_CONCEPTS[Math.floor(Math.random() * SIMULATION_CONCEPTS.length)];
    return { ...concept, niche };
  }

  const prompt = `Je bent een Etsy SEO expert en digitale product creator. Genereer een volledig Etsy listing concept voor de niche: "${niche}".

Vereisten:
- Titel: max 60 tekens, primair keyword staat VOORAAN
- Beschrijving: 300-500 woorden, eerste 160 tekens zijn cruciaal, eindig met "✦ Instant Download" sectie
- Tags: PRECIES 13 unieke tags
- Prijs: competitief voor een nieuwe shop
- DALL-E prompt: gedetailleerde prompt voor productafbeelding
- Why this sells: waarom dit product goed verkoopt

Geef je antwoord ALLEEN als geldig JSON, geen extra tekst:
{
  "title": "max 60 tekens SEO titel",
  "description": "volledige beschrijving",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13"],
  "price": 4.99,
  "dalle_prompt": "gedetailleerde afbeelding prompt",
  "why_this_sells": "uitleg"
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

  if (concept.title.length > 60) concept.title = concept.title.substring(0, 60);
  if (!Array.isArray(concept.tags) || concept.tags.length !== 13) {
    throw new Error(`Verwacht 13 tags, kreeg ${concept.tags?.length}`);
  }

  return concept;
}

async function generateWeeklyRecommendations(salesData) {
  const client = getClient();
  if (!client) {
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

// isSimulation als getter zodat het altijd de actuele waarde van process.env weerspiegelt
module.exports = {
  analyzeNiches,
  generateConcept,
  generateWeeklyRecommendations,
  get isSimulation() { return !process.env.ANTHROPIC_API_KEY; }
};
