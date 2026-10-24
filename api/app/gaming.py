"""Decides whether a story is about video games, so it lands in the gaming category.

The story text alone is weak evidence (an Xbox used to watch Netflix, a character
named Zelda), so the title and tags count most and the body needs several signals.
"""

import re

CATEGORY = "Video Games and Gaming"

# Specific games, series and game creepypastas
FRANCHISES = re.compile(
    r"\b(herobrine|minecraft|pok[eé]mon|lavender town|majora'?s mask|ben drowned|sonic\.exe|"
    r"sonic the hedgehog|super mario|mario 64|roblox|fortnite|world of warcraft|skyrim|half-life|"
    r"call of duty|polybius|killswitch|tetris|pac-man|five nights at freddy'?s|fnaf|silent hill|"
    r"resident evil|garry'?s mod|counter-strike|league of legends|runescape|animal crossing|"
    r"undertale|fallout|metroid|bethesda|mmorpg|rom hack)\b",
    re.IGNORECASE,
)

# Hardware: often just furniture in a story, so it counts for less
PLATFORMS = re.compile(
    r"\b(nintendo|playstation|ps[1-5]|xbox|game ?boy|gamecube|n64|sega|dreamcast|atari|emulator)\b",
    re.IGNORECASE,
)

GAME_WORDS = re.compile(
    r"\b(video ?games?|gaming|gamer|arcade|cartridge|playthrough|walkthrough|speedrun|"
    r"multiplayer|npc|boss fight|game over|save files?)\b",
    re.IGNORECASE,
)


def is_gaming(title: str, tags: list[str], body: str) -> bool:
    head = f"{title} {' '.join(tags)}"
    if FRANCHISES.search(head) or PLATFORMS.search(head) or GAME_WORDS.search(head):
        return True

    franchise_hits = [m.lower() for m in FRANCHISES.findall(body)]
    distinct = set(franchise_hits) | {m.lower() for m in PLATFORMS.findall(body)}
    game_words = len(GAME_WORDS.findall(body))

    return (
        len(distinct) >= 3
        or (len(distinct) >= 2 and game_words >= 2)
        or len(franchise_hits) >= 2
    )


def with_gaming_category(categories: list[str], title: str, tags: list[str], body: str) -> list[str]:
    if CATEGORY not in categories and is_gaming(title, tags, body):
        return [*categories, CATEGORY]
    return categories
