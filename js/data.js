/* ============================================================
   GALLERY DATA — photos, rooms, captions & site configuration
   Edit SITE below to change titles, about text and social links.
   ============================================================ */

const SITE = {
  title: "The Gallery of Moments",
  subtitle: "Photographs from across India",
  welcome: "Welcome to my collection of moments I have captured.",
  about: [
    "Photography has never been my job; it has always been my passion.",
    "I am still very much in the learning phase, and I will happily admit that many of the frames hanging in these halls are lucky shots — the bird that turned at just the right moment, the light that decided to behave. But I have come to believe that lucky shots deserve a platform too.",
    "That is what this gallery is: a home for the moments that were generous to me.",
    "Everything here was photographed across India — through a DSLR on good days and a phone on honest ones.",
    "Thank you for walking through."
  ],
  socials: [
    { name: "Instagram — @avn.clicks", url: "https://instagram.com/avn.clicks", icon: "◈" },
    { name: "Email", url: "mailto:mpupmpupmpup@gmail.com", icon: "✉" }
  ]
};

const ROOMS = {
  aviary:   { name: "The Aviary",          tag: "Garden birds, perch by perch",        hue: "#c98a2e" },
  wings:    { name: "Wings & Water",       tag: "Herons, egrets and open sky",         hue: "#5f8fa8" },
  wild:     { name: "Wild Encounters",     tag: "Fur, horn and scale",                 hue: "#7a6b3f" },
  streets:  { name: "Faces & Streets",     tag: "People, bazaars and festivals",       hue: "#a85f4b" },
  heritage: { name: "Heritage in Stone",   tag: "Temples, tombs and statues",          hue: "#8d7350" },
  green:    { name: "Green Earth",         tag: "Fields, forests and flowers",         hue: "#5e7d4a" },
  light:    { name: "Chasing Light",       tag: "Sun, moon and burning skies",         hue: "#c56b32" },
  longexp:  { name: "Painting with Light", tag: "Long exposures, fireworks and play",  hue: "#6b5fa8" }
};

const ROOM_ORDER = ["aviary", "wings", "wild", "streets", "heritage", "green", "light", "longexp"];

/* r = width / height of the photograph */
const PHOTOS = [
  // ------------------------- THE AVIARY -------------------------
  { id: "p010", room: "aviary", r: 0.984, title: "The Commuter",        cap: "A rock pigeon holds its ground on a steel cable, unbothered by the city below." },
  { id: "p011", room: "aviary", r: 0.924, title: "Emerald Collar",      cap: "Portrait of a pigeon, its neck feathers burning green in the sun." },
  { id: "p012", room: "aviary", r: 1.056, title: "Sapphire Thief",      cap: "A purple sunbird glints like a cut jewel among the yellow blooms." },
  { id: "p013", room: "aviary", r: 0.909, title: "The Nectar Heist",    cap: "Caught mid-raid — a purple sunbird plunges headfirst into a trumpet flower." },
  { id: "p014", room: "aviary", r: 1.341, title: "Wire Act",            cap: "A purple sunbird pauses on a cable, iridescence at full blast." },
  { id: "p015", room: "aviary", r: 1.501, title: "Scaled in Bronze",    cap: "A laughing dove's feathers stack like the tiles of a temple roof." },
  { id: "p024", room: "aviary", r: 1.211, title: "Crested, Composed",   cap: "A red-whiskered bulbul poses against a washed-white sky." },
  { id: "p025", room: "aviary", r: 1.007, title: "The Lookout",         cap: "A red-whiskered bulbul threads through a lattice of twigs." },
  { id: "p026", room: "aviary", r: 0.808, title: "Morning Regular",     cap: "A red-vented bulbul leans into the first light of the day." },
  { id: "p027", room: "aviary", r: 0.591, title: "The Punk",            cap: "Crest up, claws set — a red-vented bulbul surveys its garden." },
  { id: "p029", room: "aviary", r: 0.842, title: "Sky Watcher",         cap: "A jungle babbler tilts one pale eye at something far above." },
  { id: "p031", room: "aviary", r: 1.657, title: "Home Builders",       cap: "Jungle babblers trade twigs and opinions during nest construction." },
  { id: "p032", room: "aviary", r: 1.693, title: "The Committee",       cap: "Two babblers mid-discussion, backs firmly to the camera." },
  { id: "p035", room: "aviary", r: 1.048, title: "Golden Hour Myna",    cap: "A common myna catches the last warm light of the evening." },
  { id: "p036", room: "aviary", r: 1.150, title: "King of the Stump",   cap: "A myna claims the crown of a beheaded palm." },
  { id: "p037", room: "aviary", r: 1.400, title: "The Pair",            cap: "Red-whiskered bulbuls share a branch and a quiet moment." },
  { id: "p039", room: "aviary", r: 0.667, title: "Leaf Among Leaves",   cap: "Golden-fronted leafbirds, nearly invisible in their own shade of green." },
  { id: "p050", room: "aviary", r: 1.059, title: "The Neighbour",       cap: "A house sparrow peers out from a tangle of backyard branches." },
  { id: "p051", room: "aviary", r: 1.145, title: "Full Volume",        cap: "A purple sunbird sings with everything it has." },
  { id: "p056", room: "aviary", r: 1.614, title: "Two on a Branch",     cap: "Indian silverbills preen in the soft morning sun." },
  { id: "p063", room: "aviary", r: 0.770, title: "Dusk Sentry",         cap: "A sunbird silhouetted on thorns as the light dies behind it." },
  { id: "p064", room: "aviary", r: 0.588, title: "The Architect",       cap: "A baya weaver puts finishing touches on a hanging woven home." },
  { id: "p065", room: "aviary", r: 1.592, title: "The Waiting Room",    cap: "Silverbills line the thorny branches like commuters on a platform." },
  { id: "p066", room: "aviary", r: 0.712, title: "The Announcement",    cap: "A pied starling calls out across the fading evening." },
  { id: "p091", room: "aviary", r: 0.885, title: "Framed in Steel",     cap: "A sunbird poses dead-centre in a chain-link diamond." },

  // ------------------------ WINGS & WATER -----------------------
  { id: "p007", room: "wings", r: 0.814, title: "The Watchman",         cap: "A dove in pure silhouette, standing guard on its post." },
  { id: "p018", room: "wings", r: 1.790, title: "Grace, Folded",        cap: "A goose tucks into itself against a blown-white sky." },
  { id: "p022", room: "wings", r: 1.300, title: "Shadow Wings",         cap: "A crow spreads the whole sky between its feathers." },
  { id: "p023", room: "wings", r: 1.091, title: "Underwing",            cap: "A house crow banks directly overhead, every feather counted." },
  { id: "p028", room: "wings", r: 1.028, title: "Notes on a Branch",    cap: "A bird among berries, drawn in ink against a paper sky." },
  { id: "p038", room: "wings", r: 1.288, title: "The Feeding",          cap: "Bulbuls in silhouette, one beak reaching for another." },
  { id: "p040", room: "wings", r: 0.884, title: "One-Legged Meditation",cap: "A grey heron rests on its private island, doubled by still water." },
  { id: "p041", room: "wings", r: 1.320, title: "The Fisher King",      cap: "A grey heron surveys its kingdom from a rock." },
  { id: "p042", room: "wings", r: 1.277, title: "Periscope",            cap: "A cormorant slides low through the water, head up like a submarine." },
  { id: "p043", room: "wings", r: 0.820, title: "Ruffled",              cap: "Wind lifts a heron's plumes into a silver mane." },
  { id: "p044", room: "wings", r: 0.657, title: "Two Reflections",      cap: "A heron and a dead branch, mirrored in a pastel lake." },
  { id: "p045", room: "wings", r: 1.110, title: "Full Stretch",         cap: "A little egret unfurls over the water." },
  { id: "p046", room: "wings", r: 0.587, title: "The Wader",            cap: "An egret stalks the shallows — patience in motion." },
  { id: "p047", room: "wings", r: 1.158, title: "Spot-Billed",          cap: "An Indian spot-billed duck cruises across a white morning." },
  { id: "p048", room: "wings", r: 0.714, title: "Dark Bird, Green World", cap: "A little cormorant rests inside a wall of monsoon green." },
  { id: "p055", room: "wings", r: 1.136, title: "Contrast in Flight",   cap: "An egret in black and white — half light, half shadow." },
  { id: "p060", room: "wings", r: 1.615, title: "Sheet Music",          cap: "Birds on wires, arranged like notes on a stave." },
  { id: "p079", room: "wings", r: 1.153, title: "Behind the Wire",      cap: "A sarus crane's crimson head, pressed close to the fence between us." },
  { id: "p094", room: "wings", r: 0.500, title: "Winter Branches",      cap: "Silhouettes gather on a bare tree at dusk." },

  // ------------------------ WILD ENCOUNTERS ---------------------
  { id: "p001", room: "wild", r: 1.500, title: "The Stare",             cap: "A gaur pauses mid-graze to size up the photographer. The photographer left soon after." },
  { id: "p002", room: "wild", r: 1.500, title: "Morning in the Forest", cap: "Chital graze in first light filtering through the trees." },
  { id: "p003", room: "wild", r: 1.500, title: "The Herd",              cap: "Spotted deer freeze in golden grass — all ears, all eyes." },
  { id: "p016", room: "wild", r: 1.728, title: "Rooftop Runner",        cap: "A palm squirrel patrols the sun-baked tiles." },
  { id: "p017", room: "wild", r: 1.500, title: "Low Profile",           cap: "A squirrel slinks along the roof's edge, pretending to be invisible." },
  { id: "p019", room: "wild", r: 1.428, title: "Ready to Bolt",         cap: "A three-striped palm squirrel, coiled like a spring." },
  { id: "p020", room: "wild", r: 1.546, title: "The Close-Up",          cap: "A squirrel leans in, whiskers first." },
  { id: "p021", room: "wild", r: 0.722, title: "Snow in Summer",        cap: "A white rabbit sits neatly on the red earth." },
  { id: "p053", room: "wild", r: 1.108, title: "Street Philosopher",    cap: "A cat squints into the afternoon, thoroughly unimpressed." },
  { id: "p062", room: "wild", r: 0.669, title: "Dressed for Battle",    cap: "A rock agama in full breeding orange, posing on a boulder." },
  { id: "p078", room: "wild", r: 0.686, title: "Eye to Eye",            cap: "A golden jackal returns the gaze — steady, unblinking." },

  // ------------------------ FACES & STREETS ---------------------
  { id: "p004", room: "streets", r: 1.500, title: "Crossing",           cap: "A boy glances back on a village road, cattle drifting behind him." },
  { id: "p005", room: "streets", r: 1.500, title: "Cart Ride",          cap: "Two kids ride the family bullock cart, curiosity pointed forward." },
  { id: "p057", room: "streets", r: 0.667, title: "The Tamarind Picker",cap: "Reaching deep into the canopy for a sour harvest." },
  { id: "p068", room: "streets", r: 0.667, title: "Independence Day",   cap: "A father, a child and a flag, headed home." },
  { id: "p069", room: "streets", r: 1.500, title: "Before the Performance", cap: "Dancers gather — jasmine, silk and nerves, seen from behind." },
  { id: "p071", room: "streets", r: 0.667, title: "Old Friends",        cap: "Two elders and a conversation older than both of them." },
  { id: "p072", room: "streets", r: 0.667, title: "The Cymbal Player",  cap: "A boy keeps the rhythm alive in a temple procession." },
  { id: "p082", room: "streets", r: 0.656, title: "The Moustache",      cap: "A portrait earned by years, not posed for." },
  { id: "p101", room: "streets", r: 0.565, title: "Bangle Cascade",     cap: "A market stall drips with gold, glass and lamplight." },
  { id: "p102", room: "streets", r: 1.970, title: "Rows of Shimmer",    cap: "Bangles hang like wind chimes in a night bazaar." },
  { id: "p103", room: "streets", r: 1.500, title: "The Balloon Bunch",  cap: "Colour finds a child in a grey market crowd." },
  { id: "p106", room: "streets", r: 0.667, title: "Self-Portrait of a Generation", cap: "A silhouette raises a phone to the sky." },
  { id: "p119", room: "streets", r: 1.333, title: "Kulhads, Stacked",   cap: "Terracotta tea cups waiting for the evening rush." },
  { id: "p120", room: "streets", r: 0.750, title: "The Giant Wheel",    cap: "A fairground wheel spins colour into the dusk." },

  // ----------------------- HERITAGE IN STONE --------------------
  { id: "p070", room: "heritage", r: 0.667, title: "The Loudspeakers",  cap: "A temple tower crowned with its own voice." },
  { id: "p073", room: "heritage", r: 0.757, title: "Gopuram in Bloom",  cap: "A temple gateway painted like a garden that never wilts." },
  { id: "p080", room: "heritage", r: 0.667, title: "The Helm",          cap: "The worn wooden wheel of a working boat — decades of hands." },
  { id: "p081", room: "heritage", r: 0.726, title: "The Buddha of the Lake", cap: "A monolithic Buddha stands over the water while the tricolour flies." },
  { id: "p093", room: "heritage", r: 0.667, title: "Domes and Minarets",cap: "Weathered domes against a hard blue sky." },
  { id: "p099", room: "heritage", r: 1.500, title: "Nandi on the Hill", cap: "The stone bull keeps watch over green country." },
  { id: "p104", room: "heritage", r: 1.851, title: "Gandhi at Dusk",    cap: "The Mahatma against a bruised pink sky." },
  { id: "p107", room: "heritage", r: 0.679, title: "Devi on Rock",      cap: "A painted goddess watches from a boulder." },
  { id: "p112", room: "heritage", r: 1.333, title: "Sun over the Sun Temple", cap: "Konark's stones warming under their patron star." },
  { id: "p113", room: "heritage", r: 0.747, title: "Konark",            cap: "The chariot of the sun, carved in stone, still drawing crowds." },

  // -------------------------- GREEN EARTH -----------------------
  { id: "p008", room: "green", r: 0.667, title: "The Gap",              cap: "Trees knit a canopy between two walls of rock." },
  { id: "p009", room: "green", r: 0.667, title: "Reaching",             cap: "A lone tree climbs out of the canyon toward the light." },
  { id: "p030", room: "green", r: 0.721, title: "One Red Rose",         cap: "Petals holding their colour against a storm-grey wall." },
  { id: "p033", room: "green", r: 0.667, title: "The Banana Flower",    cap: "A garden's slow machinery, hung in maroon." },
  { id: "p034", room: "green", r: 0.866, title: "Frangipani",           cap: "Plumeria clusters — waxy, white and perfect." },
  { id: "p052", room: "green", r: 1.551, title: "Windowsill Jungle",    cap: "A family of potted plants catching the evening sun." },
  { id: "p058", room: "green", r: 0.667, title: "Millet by the River",  cap: "Grain fields running down to slow water." },
  { id: "p059", room: "green", r: 0.667, title: "Field Gold",           cap: "Millet heads glowing in late light." },
  { id: "p061", room: "green", r: 0.667, title: "Ten Thousand Flowers", cap: "A meadow of tiny white blooms, refusing to be counted." },
  { id: "p092", room: "green", r: 1.500, title: "The First Leaves",     cap: "A bare twig quietly rehearsing spring." },
  { id: "p095", room: "green", r: 1.500, title: "Monsoon over the Bridge", cap: "Storm clouds pile above white trusses." },
  { id: "p096", room: "green", r: 0.563, title: "Into the Storm",       cap: "A bridge walking straight into a monsoon sky." },
  { id: "p105", room: "green", r: 1.500, title: "Palm Congregation",    cap: "Palmyra silhouettes assembled in black and white." },
  { id: "p116", room: "green", r: 0.750, title: "Rain Lily",            cap: "Pink petals holding this morning's drizzle." },
  { id: "p117", room: "green", r: 0.750, title: "Onion Flowers at Sunrise", cap: "Seed heads on parade against the first light." },
  { id: "p118", room: "green", r: 1.333, title: "Looking Up",           cap: "Onion stalks from an ant's point of view." },

  // ------------------------- CHASING LIGHT ----------------------
  { id: "p006", room: "light", r: 0.896, title: "The Sun, Caught",      cap: "An orange sky snags the sun in a tree's arms." },
  { id: "p049", room: "light", r: 1.341, title: "Waning",               cap: "The moon shows its cratered edge." },
  { id: "p097", room: "light", r: 1.500, title: "City Before Rain",     cap: "The city sprawls under building clouds." },
  { id: "p098", room: "light", r: 1.500, title: "Ten Thousand Bulbs",   cap: "The same city, switched on." },
  { id: "p100", room: "light", r: 0.920, title: "Full Moon",            cap: "Every sea and crater, one long lens away." },
  { id: "p108", room: "light", r: 1.377, title: "Power and the Sun",    cap: "A transmission tower cradles the setting sun." },
  { id: "p109", room: "light", r: 1.456, title: "The Pigeon's Sunset",  cap: "A silhouette enjoys the show from a rooftop." },
  { id: "p110", room: "light", r: 1.308, title: "Evening Traffic",      cap: "Birds crossing a molten sky." },
  { id: "p114", room: "light", r: 0.750, title: "The Watchtower",       cap: "A beach boardwalk burns gold at sundown." },
  { id: "p121", room: "light", r: 0.749, title: "Moonrise Balustrade",  cap: "Night blooming behind an old railing." },
  { id: "p122", room: "light", r: 0.999, title: "Under All of It",      cap: "Sitting cross-legged beneath a sky full of stars." },

  // ---------------------- PAINTING WITH LIGHT -------------------
  { id: "p054", room: "longexp", r: 0.667, title: "Adrift",             cap: "Discarded things floating on a sheet of blue." },
  { id: "p067", room: "longexp", r: 0.725, title: "Guitar in Neon",     cap: "A long exposure wraps a guitar in ribbons of light." },
  { id: "p074", room: "longexp", r: 1.500, title: "Warp Speed, Parked", cap: "A zoom pull turns city lights into hyperspace." },
  { id: "p075", room: "longexp", r: 0.435, title: "The Lamp Genie",     cap: "Smoke rises from an open palm into a wicker lamp." },
  { id: "p076", room: "longexp", r: 0.411, title: "The Lamp Genie, in Red", cap: "Same lamp, different mood." },
  { id: "p077", room: "longexp", r: 0.761, title: "Ghost Cat",          cap: "A cat moving faster than the shutter — and the shutter losing." },
  { id: "p083", room: "longexp", r: 1.132, title: "Gold Burst",         cap: "A firework blooms and dies inside a single frame." },
  { id: "p084", room: "longexp", r: 0.557, title: "Red Rain",           cap: "Embers streak down the night." },
  { id: "p085", room: "longexp", r: 1.247, title: "The Big One",        cap: "A sky suddenly full of sparks." },
  { id: "p086", room: "longexp", r: 1.152, title: "Willow",             cap: "Trails drooping like a tree made of fire." },
  { id: "p087", room: "longexp", r: 1.109, title: "Chandelier",         cap: "A crackling shell hangs mid-air, briefly furniture of the sky." },
  { id: "p088", room: "longexp", r: 1.500, title: "Diwali Lines",       cap: "Festival lights drawn into streaks of gold." },
  { id: "p089", room: "longexp", r: 1.051, title: "Light in the Living Room", cap: "Fairy lights leap across a long exposure." },
  { id: "p090", room: "longexp", r: 1.500, title: "The Glowing Window", cap: "Diwali lights turn a bedroom into a lantern." },
  { id: "p111", room: "longexp", r: 0.750, title: "The Woven Sun",      cap: "A wicker ball lamp glowing like a captured star." },
  { id: "p115", room: "longexp", r: 0.750, title: "Through Darker Glass", cap: "A beach evening, framed by borrowed sunglasses." }
];
