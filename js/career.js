// All website content lives here. Edit this file to update the site —
// no need to touch the lobby or animation code.

export const profile = {
  name: "Yasser Badr",
  title: "Multiplayer Gameplay Programmer",
  level: 5, // years of experience
  location: "Cairo, Egypt",
  relocation: "Open to relocation · Spain · Germany",
  summary:
    "Multiplayer Gameplay Programmer with 5 years of experience building games in Unity and Unreal Engine 5. " +
    "Currently leading the multiplayer department on an unreleased competitive PC racing and combat game, owning the full online stack: " +
    "server-authoritative gameplay with Photon Fusion, client-side prediction and lag compensation, dedicated servers and matchmaking on PlayFab, and Steam integration.",
  email: "yasserelsayed70@gmail.com",
  linkedin: "https://www.linkedin.com/in/yasserbadrdev",
  cv: "cv/Yasser_Badr_CV.pdf",
  languages: [
    ["Arabic", "Native"],
    ["English", "B2"],
    ["German", "A2"],
    ["Spanish", "A1"],
  ],
};

// Shown in the Locker as an equipped loadout
export const loadout = [
  { slot: "Primary", item: "Photon Fusion", note: "Dedicated server · 60+ Hz", rarity: "legendary" },
  { slot: "Secondary", item: "PlayFab", note: "Servers · Matchmaking · Player data", rarity: "epic" },
  { slot: "Gadget", item: "Steamworks SDK", note: "Parties · Invites", rarity: "epic" },
  { slot: "Engine", item: "Unity · UE5", note: "C# · C++ · Blueprints", rarity: "rare" },
  { slot: "Perk", item: "Client-side Prediction", note: "+ Lag compensation", rarity: "legendary" },
  { slot: "Backup", item: "Mirror · NGO", note: "Unity Netcode for GameObjects", rarity: "rare" },
];

export const career = [
  {
    id: "hys",
    period: "Jul 2025 – Present",
    role: "Lead Multiplayer Programmer",
    company: "HYS Games",
    place: "Riyadh, Saudi Arabia (Remote)",
    points: [
      "Lead the multiplayer department (team of 2) on an unreleased competitive PC racing and combat game, 2–8 players per match.",
      "Converted the entire game to online multiplayer with Photon Fusion: vehicle control, abilities, weapons, collisions and matchmaking.",
      "Server-authoritative model at 60+ Hz with client-side prediction and lag compensation — no visible input delay.",
      "Dedicated game servers on PlayFab Multiplayer Servers, PlayFab matchmaking and cloud player-data saving.",
      "Steamworks SDK integration for Steam parties, friend invites and group play.",
    ],
    achievement: "Promoted to Lead Multiplayer",
  },
  {
    id: "dakkaken",
    period: "Oct 2023 – Jun 2025",
    role: "Game Developer",
    company: "Dakkaken",
    place: "Cairo, Egypt",
    points: [
      "Led a team of 3–4 developers building the games for Atfaluna, a children's edutainment app on Android and iOS.",
      "Designed gameplay, mechanics and environments for educational mini-games; coordinated asset integration with the art team.",
      "Built and deployed Android and iOS releases; set milestones with project managers.",
    ],
    achievement: "Shipped to 100K+ players",
  },
  {
    id: "hermits",
    period: "Nov 2022 – Oct 2023 · Intern Feb – Jun 2022",
    role: "Gameplay Programmer",
    company: "Game Hermits",
    place: "Mansoura, Egypt",
    points: [
      "Zamakan (UE5, C++): procedural generation, player controllers, pickups, obstacles, save system, VFX, UI.",
      "Illusion (UE5): interaction, doors, car driving, dialogue-tree system, player UI.",
      "Unity / C# online games: Challenge & Win, Glory Kings, Psycho X Prey (PvP networking with Mirror).",
      "VR for Meta Quest 2: Oil Check, MTEX, Oil Refinery — XR input, setup, VFX.",
    ],
    achievement: "First shipped Steam game",
  },
  {
    id: "uni",
    period: "2018 – 2022",
    role: "B.Sc. Computer and Information Sciences",
    company: "Mansoura University",
    place: "Egypt",
    points: ["Graduation project: Intra Nebulas (UE hack & slash game), grade: Excellent."],
    achievement: "Graduated with a game",
  },
];

// Projects shown on the roadside billboards. `image` can be any image URL
// (put your own screenshots in assets/projects/ later). `link` opens on click.
const yt = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const projects = {
  intra: { name: "Intra Nebulas", engine: "Unreal Engine", tag: "Graduation project", image: yt("xqJ4rKuJyxU"), link: "https://www.youtube.com/watch?v=xqJ4rKuJyxU" },
  psycho: { name: "Psycho X Prey", engine: "Unity · Mirror", tag: "3v3 online PvP", image: yt("45i-TayR_e8"), link: "https://www.youtube.com/watch?v=45i-TayR_e8" },
  mtex: { name: "MTEX", engine: "Unity · Quest 2", tag: "VR city simulation", image: yt("86nutjoSyio"), link: "https://www.youtube.com/watch?v=86nutjoSyio" },
  zamakan: { name: "Zamakan", engine: "UE5 · C++", tag: "Released on Steam", image: "https://cdn.cloudflare.steamstatic.com/steam/apps/2228100/header.jpg", link: "https://store.steampowered.com/app/2228100/Zamakan/" },
  illusion: { name: "Illusion", engine: "UE5", tag: "Story horror" },
  challenge: { name: "Challenge & Win", engine: "Unity · C#", tag: "Online word game", image: yt("6pf4yeZ2rBU"), link: "https://www.youtube.com/watch?v=6pf4yeZ2rBU" },
  glory: { name: "Glory Kings", engine: "Unity · C#", tag: "Multiplayer idle", image: yt("usc6GBhyYcI"), link: "https://www.youtube.com/watch?v=usc6GBhyYcI" },
  atfaluna: { name: "Atfaluna", engine: "Unity · Android · iOS", tag: "100K+ downloads" },
  hys: { name: "Unannounced PC racer", engine: "Photon Fusion · PlayFab", tag: "2–8 players · 60 Hz" },
  pinggo: { name: "PingGo", engine: "Co-founder", tag: "Table tennis matchmaking" },
};

// The career road, in the order you ride it. Each chapter is a zone of the road
// with its own colours, curves and billboards.
export const road = [
  {
    career: "uni", year: "2018", chapter: "Chapter 1", length: 140,
    palette: { skyTop: "#1b1440", skyBottom: "#f08a5d", ground: "#3a2a3a", ground2: "#33243a", road: "#3b3442", rumble: "#f6d365", rumble2: "#3b3442", lane: "#f6d365", accent: "#f6d365", fog: "#8a5a6a" },
    scenery: "hills",
    billboards: ["intra"],
    curves: [0, 2, -2, 0],
  },
  {
    career: "hermits", year: "2022", chapter: "Chapter 2", length: 260,
    palette: { skyTop: "#0b3a5b", skyBottom: "#5fd0e0", ground: "#123a3a", ground2: "#0f3434", road: "#2d3b44", rumble: "#e8f6ff", rumble2: "#2d3b44", lane: "#e8f6ff", accent: "#39f0e0", fog: "#4aa3b0" },
    scenery: "city",
    billboards: ["psycho", "mtex", "zamakan", "illusion", "challenge", "glory"],
    curves: [3, 0, -3, 2, 0, -2],
  },
  {
    career: "dakkaken", year: "2023", chapter: "Chapter 3", length: 170,
    palette: { skyTop: "#3a1060", skyBottom: "#ff7a59", ground: "#3a1f3f", ground2: "#341a39", road: "#3d2f45", rumble: "#ffcf5c", rumble2: "#ff5c8a", lane: "#ffcf5c", accent: "#ff7a59", fog: "#a0506a" },
    scenery: "hills",
    billboards: ["atfaluna"],
    curves: [-2, 3, 0],
  },
  {
    career: "hys", year: "2025", chapter: "Chapter 4", length: 260,
    palette: { skyTop: "#02030a", skyBottom: "#151a3a", ground: "#05070f", ground2: "#070a14", road: "#14161f", rumble: "#ff2d55", rumble2: "#f2f2f2", lane: "#39f0e0", accent: "#39f0e0", fog: "#0a0f22" },
    scenery: "neon",
    billboards: ["hys"],
    curves: [4, -4, 3, -3, 0],
  },
];

export const sideProjects = [
  {
    name: "PingGo",
    role: "Co-founder",
    text: "Competitive matchmaking platform for real-life table tennis players, with an AI-based virtual referee.",
  },
];

export const loadingTips = [
  "TIP: Yasser runs server-authoritative netcode at 60+ Hz.",
  "TIP: Client-side prediction hides latency. Lag compensation keeps hits fair.",
  "TIP: Yasser's dedicated servers run on PlayFab Multiplayer Servers.",
  "TIP: Press JOIN PARTY at the end to team up with Yasser.",
  "TIP: In a hurry? Use QUICK VIEW for the one-page CV.",
];
