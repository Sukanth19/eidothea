/* Seed data, copied into localStorage on first run (and on "reset archive").
   Redaction markup: [[1:text]] needs clearance 1 (Field Agent),
   [[2:text]] needs clearance 2 (Archivist). Paragraphs are separated by blank lines. */

window.SEED = {
  users: [
    { username: "visitor",   password: "visitor",   role: "visitor" },
    { username: "agent",     password: "agent",     role: "agent" },
    { username: "archivist", password: "archivist", role: "archivist" },
    { username: "overseer",  password: "overseer",  role: "overseer" }
  ],

  entries: [
    {
      id: "cx-003",
      designation: "CX-003",
      name: "The Hollow Lineman",
      location: "Hi-Line corridor along US-2, Hill County, Montana",
      coordinates: "48.55° N, 109.68° W",
      threatLevel: 2,
      classification: "public",
      summary: "A tall figure in a lineman's climbing harness, seen at the top of utility poles that no longer carry current. Usually at dusk. It always faces away from the road.",
      lore: `Reports go back to at least 1958, when rural electrification crews strung the last farm lines north of Havre. Witnesses describe a man-shaped figure about a third too thin, wearing old-pattern climbing spurs and a wide leather belt. It is always at the top of a dead pole, and it is always facing away.

Linemen who worked the corridor tell new hires never to take down a dead pole without checking the crossarm first. [[1:Field teams have recovered eleven sets of climbing spurs from pole tops since 1971. None were reported lost. Four still had boots attached.]]

Nobody has seen it climb up or down. It is either there or it isn't. Drivers who stop describe a low hum, like a transformer under load, coming from the pole itself. [[2:Analysis of a 1994 recording (Tape HL-7) isolates a voice inside the hum, reading out the names of farms along the line in the order they were connected. The list has been checked against county records. It includes three farms that were never built.]]

Do not approach. If you find it facing you, [[1:keep the engine running and do not look at any pole again until you have crossed the county line.]]`,
      stories: [
        {
          title: "Overtime",
          author: "posted by 'copperhead_61', IBEW retirees forum",
          date: "2009-03-14",
          body: `Worked the Hi-Line 31 years. You get used to the wind and the nothing. You never get used to him.

First time was '79, pulling a dead span outside Gildford. Foreman sees him on pole 114 and just says "leave that one." We left that one. Pole stood another twenty years with no wire on it.

Last time was my last week on the job. I was alone, which you aren't supposed to be. He was on the pole I was about to climb. Facing away like always. I sat in the truck and ate my lunch and waited for him to go, the way you wait out a storm.

When I looked up again he was gone, and my spurs weren't in the truck bed anymore.

I didn't go up to check. I'm not stupid. I retired that Friday.`
        },
        {
          title: "Field Note HL-7 (excerpt)",
          author: "Agent R. Okafor",
          date: "1994-10-02",
          body: `Recorder placed at base of pole 207 at 18:40. Ambient hum began 19:12, rising to approx. 60 Hz. Subject visible at pole top from 19:15. [[1:Subject's head turned approximately 20 degrees toward my position at 19:31. Per protocol I withdrew to the vehicle.]]

Recovered recorder at 07:00 next day. [[2:Tape had run 11 hours on a 90-minute cassette. Playback is ongoing. The voice is clearer on the second side.]]`
        }
      ],
      related: ["cx-019", "cx-011"]
    },

    {
      id: "cx-007",
      designation: "CX-007",
      name: "Mother Silt",
      location: "Atchafalaya Basin, St. Martin Parish, Louisiana",
      coordinates: "30.27° N, 91.73° W",
      threatLevel: 3,
      classification: "public",
      summary: "A human-sized shape that rises from exposed river mud during low water. It shows up near people who are grieving, and it wears the face of whoever they lost.",
      lore: `Crawfishers in the basin call her Mother Silt, or Mère Vase among the older families. She only appears when the water is low enough to show the bottom, and only to someone who has buried a family member within the year.

She takes the shape of that person, but not quite right. Witnesses say the proportions are close and the voice is close, but the mouth is always full of mud and she never blinks. She does not threaten anyone. She asks to be taken home.

[[1:We have three documented cases where the witness agreed. In each one the house was later found packed to the windowsills with dry, sun-cracked silt. The occupants were never located.]]

[[2:Sediment cores from the sites contain human teeth. Radiocarbon dates on the teeth span roughly three hundred years. Several match dental records of people reported missing from the parish.]]

If you see her, say the person's name out loud and tell her they are already home. Then walk away from the water and do not turn around.`,
      stories: [
        {
          title: "What Mawmaw Said About Low Water",
          author: "oral history, transcribed",
          date: "1974-08-20",
          body: `When the river goes down you keep the children up on the levee, and you don't go looking at the mud no matter who calls you. My sister went out to talk to our mama, and our mama had been in the ground since Easter.

She came back in and sat down to supper and she didn't say nothing. Next morning her bed was full of dirt, warm like somebody'd just got out of it.

[[1:We never did find her. Every low water after that, there's two of them out there.]]`
        }
      ],
      related: ["cx-016", "cx-023"]
    },

    {
      id: "cx-011",
      designation: "CX-011",
      name: "The Ninefold Deer",
      location: "Hiawatha National Forest, Upper Peninsula, Michigan",
      coordinates: "46.25° N, 86.65° W",
      threatLevel: 2,
      classification: "public",
      summary: "A white-tailed doe with too many legs, seen walking backwards along logging roads. Its tracks lead toward the witness's home, not away from it.",
      lore: `Hunters and trail cameras across the central U.P. have recorded a doe that moves backwards, smoothly and without looking behind it. The leg count is hard to pin down. Witnesses rarely agree, but anyone who counts out loud always reaches nine.

Its tracks are ordinary deer tracks with one odd property: they always point toward wherever the observer lives, even when they live in another state.

[[1:In 2016 a family in Alger County found tracks crossing their kitchen floor, leading backwards out of the children's bedroom. The doors had been locked.]] [[2:The children were present and unharmed. Neither one could count past eight afterwards, and neither ever learned to.]]

Do not count its legs out loud. If you already have, [[1:sleep somewhere other than home for nine nights.]]`,
      stories: [
        {
          title: "Trail Cam 14",
          author: "posted by 'MunisingBuckhunter', regional hunting forum",
          date: "2018-11-09",
          body: `Pulled the card off cam 14 this morning. 312 pics of one doe walking backwards out of frame, one picture a minute from 1am to 6am. The weird part is she never gets any further away. She's the same size in every shot.

My buddy says count the legs, so I did, out loud like an idiot. Nine.

Tracks were in my driveway when I got home. They were pointing at my door.

EDIT: mods please delete this.`
        }
      ],
      related: ["cx-003", "cx-023"]
    },

    {
      id: "cx-016",
      designation: "CX-016",
      name: "The Tallow Choir",
      location: "Deconsecrated chapels, Cambrian Mountains, Ceredigion, Wales",
      coordinates: "52.33° N, 3.80° W",
      threatLevel: 3,
      classification: "classified",
      summary: "Hymn singing heard from chapels that have been locked for decades. Investigators find candles burning inside, made of a tallow nobody can source.",
      lore: `Dozens of small Nonconformist chapels in the uplands closed during the twentieth century as their congregations drifted to the towns. In at least nine of them, passers-by report hymns being sung in Welsh after dark, slower than any living congregation would sing.

Whenever entry has been made, the chapel is empty. The pews are dusty, but candles are burning on every sill, and they were not lit by anyone with a key. The candles are tallow, not wax.

[[2:Laboratory analysis (ref. CX-016-L2) identifies the tallow as rendered human fat. No recent missing-persons cases in the area account for the quantity.]]

The number of voices is growing. A 1952 recording has an estimated twelve. A 2021 recording at the same chapel has more than forty. [[2:One of the voices on Tape CX-016-C has been identified as Agent D. Price, who hummed along during a survey in 2019 against standing orders. Agent Price is not otherwise missing. He does not remember the tune.]]

Standing orders: never hum, sing, or mouth the words. Never relight a candle that has gone out.`,
      stories: [
        {
          title: "Letter from a chapel caretaker",
          author: "found in Ceredigion county archive, translated",
          date: "1931-01-11",
          body: `Sir, I am writing again about Capel Bethania. The doors are locked and I keep the only key, yet there is singing every Sunday night. The hymn is "Calon Lân", but slower, so much slower that it is hard to bear.

I went in last week. Every candle was lit, and they smelled like a butcher's yard. A hymn book was open on the front pew to a page that has no printed words, only names in pencil.

[[2:Mine was the last name. The ink was still wet.]]

I ask you to send someone. I do not plan to go in again.`
        },
        {
          title: "Recording Log CX-016-C",
          author: "Archivist M. Hale",
          date: "2021-06-30",
          body: `Duration 47:12. Estimated voice count 41 (+3 since the previous survey). Pitch drops by a quarter-tone every eleven minutes.

[[2:At 38:02 a voice speaks over the hymn in English: "There's room in the front pew." Spectral match to Agent Price: 94%.]]`
        }
      ],
      related: ["cx-007"]
    },

    {
      id: "cx-019",
      designation: "CX-019",
      name: "The Lamplighter of Route 9",
      location: "Decommissioned County Route 9, Esmeralda County, Nevada",
      coordinates: "37.70° N, 117.24° W",
      threatLevel: 4,
      classification: "classified",
      summary: "A figure with an oil lantern standing on the shoulder of a desert highway that closed in 1962. Drivers who slow down to look never arrive anywhere.",
      lore: `County Route 9 was closed in 1962 and the asphalt has mostly gone back to sand. Navigation apps still send drivers down it.

On the old road, at night, a figure stands at the shoulder holding a lit oil lantern up at head height, as if signalling. It stands beside mile markers that were never installed: 9½, 9¾, 9⅞. If you drive past without slowing, you see it again further on, closer to the road each time.

[[2:Forty-one vehicles have been recovered on or near Route 9 since 1964. In every case the headlights were on, the fuel tank was full, and the cabin was empty. The batteries have never gone flat, including in vehicles left there for years.]]

Do not slow down. Do not flash your headlights at it, because it reads that as an answer. [[2:Since 1971 the state DOT has quietly removed Route 9 from printed maps. Online routing services add it back within weeks. We have not identified who is submitting the edits.]]`,
      stories: [
        {
          title: "Dispatch transcript, 03:12",
          author: "Esmeralda County Sheriff's radio log",
          date: "1988-07-17",
          body: `UNIT 4: Dispatch, I've got a fella with a lantern on the old Nine, waving me down.
DISPATCH: Four, there's no traffic on Nine. That road's closed.
UNIT 4: Well he's on it. Mile marker says nine and a half. I'm slowing down.
DISPATCH: Four, do not stop. Repeat, do not stop.
UNIT 4: He's real polite. He says the light's for me.
[[2:DISPATCH: Four?]]
[[2:UNIT 4: (lantern hiss, 41 seconds)]]

Unit 4 was recovered at 06:50, headlights on and the engine idling.`
        },
        {
          title: "Map review, 1 star",
          author: "anonymous user, online maps",
          date: "2023-02-04",
          body: `Shortcut saves 40 min. Road is rough but fine. Nice old man at the side with a lamp, really sweet, he walked alongside the car for a while.

[[2:Review posted 11 days after the reviewer's vehicle was recovered.]]`
        }
      ],
      related: ["cx-003"]
    },

    {
      id: "cx-023",
      designation: "CX-023",
      name: "The Quiet Tenant",
      location: "Pre-1920 apartment buildings, Brush Park, Detroit, Michigan",
      coordinates: "42.34° N, 83.05° W",
      threatLevel: 5,
      classification: "classified",
      summary: "Something living inside the walls of old apartment buildings that knocks back when you knock. Tenants who answer start losing rooms.",
      lore: `It begins with knocking inside a wall, a pattern of two or three taps. If the tenant knocks the same pattern back, it answers.

Over the next few weeks it starts knocking the tenant's pattern before they have knocked. Then a room disappears. A doorway gets painted over, or the floor plan simply no longer has space for it, and visitors insist the apartment was always this size.

[[2:Building surveys in the affected blocks show interior volume falling with no construction recorded. One building (designated D-4) lost about 18% of its measured volume between 1998 and 2019. The missing space has not been found.]]

[[2:Threat Level V was assigned after the then-Overseer's own apartment was found to have one fewer bedroom than the lease specifies. The Overseer has no memory of the child who slept there. The lease lists two occupants.]]

Do not knock back. If you hear it knock your pattern first, leave that day. Take nothing out of the walls with you.`,
      stories: [
        {
          title: "Maintenance request #4471",
          author: "tenant, unit 3B, Building D-4",
          date: "2019-04-22",
          body: `There is knocking in the wall behind the bathroom mirror. I knocked back as a joke. Now it does "shave and a haircut" every night at 2am and I never taught it that one.

Also my lease says 3BR but I can only find two. Super says it's always been a 2BR. Can someone come measure?`
        },
        {
          title: "Voicemail, transcribed",
          author: "recovered from Agent T. Bell's phone",
          date: "2019-05-03",
          body: `Hey, it's me. I'm in 3B. The tenant's fine, she's just confused, she keeps asking who the third toothbrush belongs to.

[[2:Okay, it's knocking. It's knocking my pattern. I never told anyone my pattern.]]

[[2:Why is the hallway shorter.]]`
        }
      ],
      related: ["cx-011", "cx-007"]
    }
  ]
};
